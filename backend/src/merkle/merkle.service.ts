// src/merkle/merkle.service.ts
import { Injectable } from '@nestjs/common';
import * as circomlibjs from 'circomlibjs';
import { stringToFrBigInt, bigIntToBuffer, toHex32Buf } from './utils';
import { PatientRow } from './interfaces/merkleTree';
import { Patient } from '../patients/patient.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { getPoseidon } from './poseidon';

function normalize(s: string): string {
  return String(s ?? '').trim();
}

// --- New utility for type safety ---
function toBigInt(val: any): bigint {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number') return BigInt(val);
  if (val instanceof Uint8Array || Buffer.isBuffer(val)) {
    return BigInt('0x' + Buffer.from(val).toString('hex'));
  }
  // Some circomlibjs versions may have BN.js/bigint objects with toString
  if (val && typeof val.toString === 'function') {
    const dec = val.toString();
    // Try decimal and hex
    if (/^[0-9]+$/.test(dec)) return BigInt(dec);
    if (/^0x[0-9a-f]+$/i.test(dec)) return BigInt(dec);
  }
  throw new Error(`Cannot coerce value to BigInt: ${JSON.stringify(val)}`);
}

@Injectable()
export class MerkleService {
  poseidon: typeof circomlibjs.poseidon;
  poseidonReady: Promise<any>;
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {
    this.poseidonReady = getPoseidon().then((p) => (this.poseidon = p));
  }
  normalizeRow(p: PatientRow): PatientRow {
    return {
      hospital_id: normalize(p.hospital_id),
      treatment: normalize(p.treatment),
      patient_id: normalize(p.patient_id),
    };
  }
  // Must be awaited everywhere
  async patientLeaf(p: PatientRow): Promise<BigInt> {
    await this.poseidonReady;
    const fields = [
      stringToFrBigInt(p.hospital_id),
      stringToFrBigInt(p.treatment),
      stringToFrBigInt(p.patient_id),
    ];
    // Always return BigInt!
    return toBigInt(this.poseidon(fields));
  }

  // The function (fields must be non-empty!)
  async getProof(allPatients: PatientRow[], queryPatient: PatientRow) {
    allPatients.forEach((row, i) => {
      ['hospital_id', 'treatment', 'patient_id'].forEach((f) => {
        if (!row[f]) throw new Error(`PatientRow ${i} missing ${f}`);
        if (typeof row[f] !== 'string' || row[f].length < 1)
          throw new Error(`PatientRow ${i} field ${f} is empty`);
      });
    });
    await this.poseidonReady;
    const poseidon = this.poseidon;

    // Each leaf is: Poseidon([hospital, treatment, patient]) as a field element (always BigInt)
    const patientLeaf = (row: PatientRow): BigInt =>
      toBigInt(
        poseidon([
          stringToFrBigInt(row.hospital_id),
          stringToFrBigInt(row.treatment),
          stringToFrBigInt(row.patient_id),
        ]),
      );

    // Build leaves (ALWAYS BigInt)
    const leaves: BigInt[] = allPatients.map(patientLeaf);
    const queryHash = patientLeaf(queryPatient);

    // Use value equality for BigInt!
    const index = leaves.findIndex(
      (l) => l.toString() === queryHash.toString(),
    );
    if (index === -1)
      throw new Error('Query patient not found in patient set (Merkle leaf)');

    // Build Merkle tree
    const levels: BigInt[][] = [leaves];
    let curr = leaves;
    while (curr.length > 1) {
      const next: BigInt[] = [];
      for (let i = 0; i < curr.length; i += 2) {
        if (i + 1 === curr.length) {
          next.push(toBigInt(curr[i])); // wrap single node!
        } else {
          next.push(
            toBigInt(poseidon([toBigInt(curr[i]), toBigInt(curr[i + 1])])),
          );
        }
      }
      levels.push(next);
      curr = next;
    }
    const root = toBigInt(curr[0]);

    // Build sibling path (ALWAYS BigInt)
    let idx = index;
    const path: BigInt[] = [];
    for (let level = 0; level < levels.length - 1; level++) {
      const arr = levels[level];
      const siblingIdx = idx ^ 1;
      // Always push BigInt!
      path.push(toBigInt(siblingIdx < arr.length ? arr[siblingIdx] : arr[idx]));
      idx = Math.floor(idx / 2);
    }

    // Debug checks
    for (const [i, bi] of path.entries()) {
      if (typeof bi !== 'bigint') {
        console.error(
          'BAD SIBLING (not BigInt!): index',
          i,
          'value:',
          bi,
          bi && bi.constructor && bi.constructor.name,
        );
        throw new Error(`Path element at ${i} is not BigInt`);
      }
      const buf = bigIntToBuffer(bi);
      if (buf.length !== 32) {
        console.error(`BAD SIBLING: index ${i}, value:`, bi, 'buffer:', buf);
        throw new Error(`Merkle sibling is not 32 bytes! Got ${buf.length}`);
      }
    }

    // Convert all to 32-byte hex
    const merklePathHex = path.map((bi) => {
      return toHex32Buf(bigIntToBuffer(bi));
    });
    const merkleRootHex = toHex32Buf(bigIntToBuffer(root));

    // Final assertion before returning
    merklePathHex.forEach((s, i) => {
      if (!/^0x[0-9a-fA-F]{64}$/.test(s))
        throw new Error(`merkle_path[${i}] bad hex: ${s}`);
    });
    console.log('[INFO] --- Merkle/Proof Construction ---');
    console.log('[INFO] All Patient Inputs (after filtering):', allPatients);
    console.log('[INFO] Query Patient:', queryPatient);

    console.log(
      '[INFO] Poseidon Leaf (BigInt):',
      (await this.patientLeaf(queryPatient)).toString(16),
    );
    console.log('[INFO] Leaf Index:', index);
    console.log('[INFO] Merkle Path:', merklePathHex);
    console.log('[INFO] Merkle Root:', merkleRootHex);

    console.log('[INFO] ProofRequest payload:', {
      ...queryPatient,
      merkle_leaf_index: index,
      merkle_path: merklePathHex,
      merkle_root: merkleRootHex,
    });
    if (!/^0x[0-9a-fA-F]{64}$/.test(merkleRootHex))
      throw new Error(`merkle_root bad hex: ${merkleRootHex}`);
    // Also expose leaf index and (optionally) leaf hash
    return {
      merkle_leaf_index: index,
      merkle_path: merklePathHex,
      merkle_root: merkleRootHex,
    };
  }
}
