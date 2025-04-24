import { Injectable } from '@nestjs/common';
import * as circomlibjs from 'circomlibjs';
import { stringToFrBigInt, bigIntToBuffer, toHex32Buf, ensureBigInt } from './utils';
import { PatientRow } from './interfaces/merkleTree';
import { MERKLE_PATH_LEN } from './constants/constants';

@Injectable()
export class MerkleService {
  poseidon: typeof circomlibjs.poseidon;
  poseidonReady: Promise<any>;
  readonly ready: Promise<void>;
  
  constructor() {
    this.poseidonReady = circomlibjs.buildPoseidon().then(p => (this.poseidon = p));
    this.ready = this.poseidonReady.then(() => undefined);
  }
  
  async patientLeaf(p: PatientRow): Promise<bigint> {
    await this.poseidonReady;
    if (typeof p.hospital_id !== "string") {
      console.error("hospital_id is not a string:", p.hospital_id, typeof p.hospital_id);
    }
    if (typeof p.treatment !== "string") {
      console.error("treatment is not a string:", p.treatment, typeof p.treatment);
    }
    if (typeof p.patient_id !== "string") {
      console.error("patient_id is not a string:", p.patient_id, typeof p.patient_id);
    }
    return ensureBigInt(this.poseidon([
      stringToFrBigInt(p.hospital_id),
      stringToFrBigInt(p.treatment),
      stringToFrBigInt(p.patient_id),
    ]));
  }
  
  // Use as in the class above
  async getProof(allPatients: PatientRow[], queryPatient: PatientRow) {
    await this.poseidonReady;
    let leaves: bigint[] = await Promise.all(allPatients.map(p => this.patientLeaf(p)));
    while (leaves.length < (1 << MERKLE_PATH_LEN)) {
      leaves.push(ensureBigInt(this.poseidon([
        stringToFrBigInt("DUMMY"),
        stringToFrBigInt("DUMMY"),
        stringToFrBigInt(String(leaves.length)),
      ])));
    }
    const queryHash = await this.patientLeaf(queryPatient);
    const index = leaves.findIndex(l => l === queryHash);
    if (index === -1) throw new Error('Query patient not found in patient set');
    // Build tree levels
    const levels: bigint[][] = [leaves];
    let curr = leaves;
    for (let level = 0; level < MERKLE_PATH_LEN; level++) {
      const next: bigint[] = [];
      for (let i = 0; i < curr.length; i += 2) {
        next.push(ensureBigInt(this.poseidon([
          ensureBigInt(curr[i]), ensureBigInt(curr[i + 1])
        ])));
      }
      levels.push(next);
      curr = next;
    }
    const root = curr[0];
    // Compute sibling path
    let idx = index;
    const path: bigint[] = [];
    for (let level = 0; level < MERKLE_PATH_LEN; level++) {
      const sibIdx = idx ^ 1;
      path.push(levels[level][sibIdx]);
      idx = Math.floor(idx / 2);
    }
    return {
      merkle_leaf_index: index,
      merkle_path: path.map(bi => toHex32Buf(bigIntToBuffer(bi))),
      merkle_root: toHex32Buf(bigIntToBuffer(root)),
      commitment: toHex32Buf(bigIntToBuffer(queryHash)), // optional for debug
    };
  }
}