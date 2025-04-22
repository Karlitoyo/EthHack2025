import * as circomlibjs from 'circomlibjs';
import { PatientRow } from './interfaces/merkleTree';
import { stringToFrBigInt, ensureBigInt, bigIntToBuffer } from './utils';
import { MERKLE_PATH_LEN } from './constants/constants';

export class MerkleManager {
  poseidon: typeof circomlibjs.poseidon;

  constructor(poseidon: typeof circomlibjs.poseidon) {
    this.poseidon = poseidon;
  }

  // Build leaf hash, matching your ZK circuit
  patientLeaf({ hospital_id, treatment, patient_id }: PatientRow): BigInt {
    const fr_hospital = stringToFrBigInt(hospital_id);
    const fr_treatment = stringToFrBigInt(treatment);
    const fr_patient = stringToFrBigInt(patient_id);
    // Always enforce BigInt
    return ensureBigInt(this.poseidon([fr_hospital, fr_treatment, fr_patient]));
  }

  // Build the full tree and lookup proof
  async getProof(
    allPatients: PatientRow[],
    queryPatient: PatientRow,
  ): Promise<{
    root: Buffer;
    leafHash: Buffer;
    index: number;
    path: Buffer[];
  }> {
    // 1. Build leaf array
    const leaves: BigInt[] = allPatients.map((p) =>
      ensureBigInt(this.patientLeaf(p)),
    );

    // 2. Build tree (see previous PoseidonMerkleTree), but let's inline it here for clarity
    const levels: BigInt[][] = [];
    levels.push([...leaves]);
    let curr = [...leaves];
    while (curr.length > 1) {
      const next: BigInt[] = [];
      for (let i = 0; i < curr.length; i += 2) {
        if (i + 1 === curr.length) {
          next.push(ensureBigInt(curr[i])); // not just curr[i]
        } else {
          const hash = this.poseidon([
            ensureBigInt(curr[i]),
            ensureBigInt(curr[i + 1]),
          ]);
          next.push(ensureBigInt(hash)); // not just hash
        }
      }
      levels.push(next);
      curr = next;
    }
    const root = curr[0];

    // 3. Find query leaf
    const queryHash = this.patientLeaf(queryPatient);
    const index = leaves.findIndex(
      (l) => l.toString() === queryHash.toString(),
    );
    if (index === -1) throw new Error('Patient not found in this Merkle set');

    // 4. Compute proof path (array of sibling at each level)
    let idx = index;
    const path: BigInt[] = [];
    for (let level = 0; level < levels.length - 1; level++) {
      const arr = levels[level];
      const siblingIdx = idx ^ 1;
      if (siblingIdx < arr.length) {
        path.push(arr[siblingIdx]);
      } else {
        path.push(arr[idx]);
      }
      idx = Math.floor(idx / 2);
    }

    while (path.length < MERKLE_PATH_LEN) {
      path.push(BigInt(0));
    }
    if (path.length !== MERKLE_PATH_LEN) {
      throw new Error(`Merkle path must have ${MERKLE_PATH_LEN} siblings, got ${path.length}`);
    }

    const pathBufs = path.map((bi) => {
      if (typeof bi !== 'bigint')
        throw new Error('Merkle path value is not BigInt!');
      return bigIntToBuffer(bi);
    });

    // Return all as Buffer for serialization
    return {
      root: bigIntToBuffer(ensureBigInt(root)),
      leafHash: bigIntToBuffer(ensureBigInt(queryHash)),
      index,
      path: pathBufs,
    };
  }
}
