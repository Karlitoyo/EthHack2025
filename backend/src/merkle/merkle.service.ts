import { Injectable } from '@nestjs/common';
import { rustPoseidonHash } from './poseidon';
import { PatientRow } from './interfaces/merkleTree';
import { MERKLE_PATH_LEN } from './constants/constants';
import { hexToBytesBE, FIELD_MODULUS, toHex32 } from './utils';

@Injectable()
export class MerkleService {
  ready: boolean = true;

  static modFr(x: bigint): bigint {
    return x % FIELD_MODULUS;
  }

  // LEAVES: always hash as string_to_fr via Rust
  async patientLeaf(p: PatientRow): Promise<bigint> {
    let leafVal = BigInt(
      await rustPoseidonHash([
        p.hospital_id.toString(),
        p.treatment.toString(),
        p.patient_id.toString(),
      ]),
    );
    leafVal = MerkleService.modFr(leafVal);
    if (leafVal >= FIELD_MODULUS) throw new Error("HashVal out of Fr!");
    console.log(
      '[patientLeaf] hashing args:', p.hospital_id, p.treatment, p.patient_id,
    );
    console.log('[patientLeaf] resulting leaf (hex, modFr):', toHex32(leafVal));
    return leafVal;
  }

  async getProof(allPatients: PatientRow[], queryPatient: PatientRow) {
    let leaves: bigint[] = [];
    console.log('[getProof] Start gathering leaves for all patients...');
    for (const p of allPatients) {
      const leaf = await this.patientLeaf(p);
      if (leaf >= FIELD_MODULUS) throw new Error('Leaf out of Fr after modFr!');
      leaves.push(leaf);
      console.log('[getProof] Leaf for patient:', p.patient_id, '=', toHex32(leaf));
    }
    while (leaves.length < 1 << MERKLE_PATH_LEN) {
      console.log('[getProof] Adding dummy leaves, current length:', leaves.length);
      let dummyLeafVal = BigInt(
        await rustPoseidonHash(['DUMMY', 'DUMMY', String(leaves.length)]),
      );
      dummyLeafVal = MerkleService.modFr(dummyLeafVal);
      leaves.push(dummyLeafVal);
      console.log('[getProof] Dummy leaf (modFr):', toHex32(dummyLeafVal));
    }

    let queryLeaf = await this.patientLeaf(queryPatient);
    queryLeaf = MerkleService.modFr(queryLeaf);
    if (queryLeaf >= FIELD_MODULUS) throw new Error("HashVal out of Fr!");
    console.log('[CHECK] queryLeaf bigint (modFr):', queryLeaf.toString(10), 'hex:', toHex32(queryLeaf));
    if (queryLeaf >= FIELD_MODULUS) {
      console.log('BAD: value too large for BLS12-381 Fr!');
    }
    console.log('queryLeaf (as bigint, modFr):', queryLeaf.toString(10));
    console.log('queryLeaf (as hex, BE):', toHex32(queryLeaf));
    // Avoid LE flips for public input calculation.

    const index = leaves.findIndex((l) => l === queryLeaf);
    if (index === -1) throw new Error('Query patient not found in patient set');
    let levels: bigint[][] = [leaves];
    let curr = leaves;
    // Merkle-up
    for (let level = 0; level < MERKLE_PATH_LEN; level++) {
      const next: bigint[] = [];
      for (let i = 0; i < curr.length; i += 2) {
        const left = curr[i];
        const right = curr[i + 1];
        // # PATCH: always pass BE hex for internal nodes/parents
        let parentVal = BigInt(
          await rustPoseidonHash([toHex32(left), toHex32(right)]),
        );
        parentVal = MerkleService.modFr(parentVal);
        if (parentVal >= FIELD_MODULUS) throw new Error("HashVal out of Fr!");
        next.push(parentVal);
        console.log(
          '[getProof] Level', level,
          ' Hashing pair: left=', toHex32(left),
          ' right=', toHex32(right),
          ' parent=', toHex32(parentVal),
        );
      }
      levels.push(next);
      curr = next;
    }
    const root = curr[0];

    // Merkle path as 0x... 32B hex
    let idx = index;
    const path: string[] = [];
    for (let level = 0; level < MERKLE_PATH_LEN; level++) {
      const sibIdx = idx ^ 1;
      path.push(toHex32(levels[level][sibIdx])); // always 0x... 32B hex
      console.log(
        '[getProof] Level', level,
        ' Sibling at index', sibIdx,
        ' Path element:', toHex32(levels[level][sibIdx]),
      );
      idx = Math.floor(idx / 2);
    }
    // Debug prints
    console.log('[getProof] Final Merkle Root:', toHex32(root));
    console.log('[getProof] Merkle Path:', path);
    await this.logMerkleDebug({
      patient: queryPatient,
      leafIndex: index,
      leafHex: toHex32(queryLeaf),
      path,
      levels,
    });

    const isValid = await this.verifyMerkleProof(
      toHex32(queryLeaf), path, toHex32(root),
    );
    if (isValid) console.log('[getProof] Proof is valid!');
    else console.log('[getProof] Proof is invalid!');

    // Public inputs as 32B BE (for Rust ZKP)
    return {
      merkle_leaf_index: index,
      merkle_path: path,                   // each is 0x... 32B
      merkle_root: toHex32(root),          // 0x... 32B BE
      commitment: toHex32(queryLeaf),      // 0x... 32B BE
      proof_valid: isValid,
      public_inputs: [
        Array.from(hexToBytesBE(toHex32(root))),
        Array.from(hexToBytesBE(toHex32(queryLeaf))),
      ],
    };
  }

  async logMerkleDebug({ patient, leafIndex, leafHex, path, levels }) {
    console.log('== JS Merkle Membership Debug ==');
    console.log('Patient:', patient);
    console.log('Leaf index:', leafIndex);
    console.log('Leaf value:', leafHex);
    // NOTE: for Merkle path, always keep parent/sibling as 0x... BE hex
    let cur = BigInt(leafHex);
    for (let i = 0; i < path.length; i++) {
      const sibHex = path[i];
      const bit = (leafIndex >> i) & 1;
      const left = bit ? BigInt(sibHex) : cur;
      const right = bit ? cur : BigInt(sibHex);
      console.log(
        `Level ${i}: Direction bit=${bit} (You are on ${bit === 1 ? 'right' : 'left'})`
      );
      console.log(`  Sibling: ${toHex32(BigInt(sibHex))}`);
      console.log(`  PoseidonHash([${toHex32(left)}, ${toHex32(right)}])`);
      cur = await rustPoseidonHash([toHex32(left), toHex32(right)]).then((x) =>
        MerkleService.modFr(BigInt(x))
      );
      console.log(`  --> Combined Hash: ${toHex32(cur)}`);
    }
    console.log('Computed JS Merkle Root:', toHex32(cur));
  }

  async verifyMerkleProof(leaf: string, proof: string[], root: string): Promise<boolean> {
    // leaf should be 0x... 32-byte BE hex
    let computedHash = leaf;
    for (let i = 0; i < proof.length; i++) {
      const sibling = proof[i];
      // Always pass both as 0x...32B hex for Rust
      computedHash = await rustPoseidonHash([computedHash, sibling]);
      computedHash = toHex32(MerkleService.modFr(BigInt(computedHash)));
    }
    return computedHash === root;
  }
}