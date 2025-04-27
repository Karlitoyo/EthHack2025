import { Injectable } from '@nestjs/common';
import { rustPoseidonHash, rustStringToFr } from './poseidon';
import { PatientRow } from './interfaces/merkleTree';
import { MERKLE_PATH_LEN } from './constants/constants';
import { hexToBytesBE, FIELD_MODULUS, toHex32 } from './utils';

@Injectable()
export class MerkleService {
  ready: boolean = true;
  static modFr(x: bigint): bigint {
    return x % FIELD_MODULUS;
  }

  async patientLeaf(p: PatientRow): Promise<string> {
    const fr_hospital_id = await rustStringToFr(p.hospital_id);
    const fr_treatment   = await rustStringToFr(p.treatment);
    const fr_patient_id  = await rustStringToFr(p.patient_id);
    return await rustPoseidonHash([fr_hospital_id, fr_treatment, fr_patient_id]); // 0x..., Fr, 32 bytes
  }

  async computeMerkleRootFromPath(
    path: string[],
    leaf: string,
    index: number,
  ): Promise<string> {
    let cur = leaf;
    for (let i = 0; i < path.length; i++) {
      const sibling = path[i];
      const bit = (index >> i) & 1;
      const left = bit ? sibling : cur;
      const right = bit ? cur : sibling;
      cur = await rustPoseidonHash([left, right]);
      cur = toHex32(MerkleService.modFr(BigInt(cur)));
    }
    return cur;
  }
 /**
   * Computes a ZKP-compatible Merkle tree using only field-reduced Frs
   *
   * @param allPatients Array of PatientRow to include in tree
   * @param queryPatient The patient for which to make the proof
   */
  async getProof(allPatients: PatientRow[], queryPatient: PatientRow) {
    // (1) Compute all leaf values (strings → field → poseidon)
    const leaves: string[] = []; // Each is 0x...hex
    for (const p of allPatients) leaves.push(await this.patientLeaf(p));

    // (2) Pad leaves (for full tree)
    while (leaves.length < (1 << MERKLE_PATH_LEN)) {
      // Use special form so the string_to_fr hash is consistent!
      const dummy_fr0 = await rustStringToFr("DUMMY");
      const dummy_fr1 = await rustStringToFr("DUMMY");
      const dummy_fr2 = await rustStringToFr(String(leaves.length));
      const dummy_leaf = await rustPoseidonHash([dummy_fr0, dummy_fr1, dummy_fr2]);
      leaves.push(dummy_leaf);
    }

    // (3) Compute the query leaf for the actual patient (again via string_to_fr → poseidon)
    // NB: it MUST be identical to one in leaves array (or throw if not found)
    const query_leaf = await this.patientLeaf(queryPatient);
    const leaf_idx = leaves.findIndex((x) => x.toLowerCase() === query_leaf.toLowerCase());
    if (leaf_idx === -1)
      throw new Error("Query patient leaf not found in tree!");

    // (4) Build the tree, always use 0x...hex Fr as left/right, never raw values
    const levels: string[][] = [leaves];
    let cur = leaves;
    for (let depth = 0; depth < MERKLE_PATH_LEN; depth++) {
      const next: string[] = [];
      for (let i = 0; i < cur.length; i += 2) {
        const left = cur[i], right = cur[i + 1];
        const parent = await rustPoseidonHash([left, right]);
        next.push(parent); // Always 0x...hex
      }
      levels.push(next);
      cur = next;
    }
    const merkle_root = cur[0]; // root as 0x...

    // (5) Compute Merkle path (sibling at each level as 0x...hex)
    let idx = leaf_idx;
    const path: string[] = [];
    for (let depth = 0; depth < MERKLE_PATH_LEN; depth++) {
      const sibIdx = idx ^ 1;
      path.push(levels[depth][sibIdx]);
      idx = Math.floor(idx / 2);
    }

    // (6) For frontend/manual debug, show leaf → root tracing matches circuit
    const DEBUG_LOG = true; // Control debug logging
    let test_cur = query_leaf;
    for (let i = 0; i < path.length; i++) {
      const sibling = path[i];
      const bit = (leaf_idx >> i) & 1;
      const left  = bit ? sibling : test_cur; // If on right, sibling left; else, leaf left
      const right = bit ? test_cur : sibling;
      
      const LOG_PREFIX = `JS Merkle Level ${i}:`;
      if (DEBUG_LOG) {
        console.log(`${LOG_PREFIX} left=${left} right=${right}`);
      }
      
      test_cur = await rustPoseidonHash([left, right]);
    }
    
    const ROOT_LOG_PREFIX = "JS Recomputed root from proof:";
    if (DEBUG_LOG) {
      console.log(`${ROOT_LOG_PREFIX} ${test_cur}`);
    }
    console.log('Merkle path output length:', path.length);
    const proofValue = {
      merkle_leaf_index: leaf_idx,
      merkle_path: path,               // Each as 0x...hex Fr
      merkle_root: merkle_root,        // 0x...hex Fr
      // commitment: query_leaf,          // 0x...hex Fr, matches circuit's poseidon
      // public_inputs: [
      //   Array.from(hexToBytesBE(merkle_root)),
      //   Array.from(hexToBytesBE(query_leaf)),
      // ],
    };

    console.log("== Merkle proof ==", proofValue);
    
    // (7) Assemble public_inputs arrays (root, commitment) as 32B BE arrays
    return proofValue
  }

  /**
   * Verifies a Merkle proof.
   * @param leaf The leaf node to verify.
   * @param proof The Merkle proof (array of sibling nodes).
   * @param root The expected Merkle root.
   * @returns True if the proof is valid, false otherwise.
   */
  async verifyMerkleProof(leaf: string, proof: string[], root: string, index: number): Promise<boolean> {
    let computed = leaf;
    for (let i = 0; i < proof.length; i++) {
      const sibling = proof[i];
      const bit = (index >> i) & 1;
      const left = bit ? sibling : computed;
      const right = bit ? computed : sibling;
      computed = await rustPoseidonHash([left, right]);
    }
    return computed.toLowerCase() === root.toLowerCase();
  }
}
