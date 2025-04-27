import { Injectable, Logger } from '@nestjs/common';
import { rustPoseidonHash, rustStringToFr } from './poseidon';
import { PatientRow } from './interfaces/merkleTree';
import { MERKLE_PATH_LEN } from './constants/constants';
import { FIELD_MODULUS, toHex32 } from './utils';

@Injectable()
export class MerkleService {
  private readonly logger = new Logger(MerkleService.name);
  ready: boolean = true;
  
  static modFr(x: bigint): bigint {
    return x % FIELD_MODULUS;
  }

  // LEAF
  async patientLeaf(p: PatientRow): Promise<string> {
    this.logger.verbose(`[JS-MERKLE] Creating leaf for patient_id=[${p.patient_id}] hospital_id=[${p.hospital_id}] treatment=[${p.treatment}]`);
    const fr_hospital_id = await rustStringToFr(p.hospital_id);
    const fr_treatment   = await rustStringToFr(p.treatment);
    const fr_patient_id  = await rustStringToFr(p.patient_id);
    this.logger.verbose(`[JS-MERKLE] Field representations: hospital_id: ${fr_hospital_id} treatment: ${fr_treatment} patient_id: ${fr_patient_id}`);
    const leaf = await rustPoseidonHash([fr_hospital_id, fr_treatment, fr_patient_id]);
    this.logger.log(`[JS-MERKLE] LEAF: ${leaf}`);
    return leaf; // 0x..., Fr, 32 bytes
  }

  // MERKLE root from path (standalone)
  async computeMerkleRootFromPath(
    path: string[],
    leaf: string,
    index: number,
  ): Promise<string> {
    this.logger.log(`[JS-PROOF] Computing Merkle root from proof path: leaf=${leaf} index=${index}`);
    let cur = leaf;
    for (let i = 0; i < path.length; i++) {
      const sibling = path[i];
      const bit = (index >> i) & 1;
      const left = bit ? sibling : cur;
      const right = bit ? cur : sibling;
      this.logger.log(`[JS-PROOF] LEVEL=${i} (bit=${bit}) | left=${left} | right=${right}`);
      const nextCur = await rustPoseidonHash([left, right]);
      this.logger.log(`[JS-PROOF] LEVEL=${i} | poseidon([left,right]) => ${nextCur}`);
      cur = toHex32(MerkleService.modFr(BigInt(nextCur)));
    }
    this.logger.log(`[JS-PROOF] Final computed Merkle root: ${cur}`);
    return cur;
  }

  // Main proof generator
  async getProof(allPatients: PatientRow[], queryPatient: PatientRow) {
    this.logger.log(`[JS-PROOF] Generating proof for patient ${queryPatient.patient_id} out of ${allPatients.length} patients`);
    // (1) Compute leaves
    this.logger.log(`[JS-PROOF] (1) Computing leaf values for ${allPatients.length} patients`);
    const leaves: string[] = [];
    for (const p of allPatients) {
      const leaf = await this.patientLeaf(p);
      this.logger.log(`[JS-PROOF] Leaf for patient_id=${p.patient_id}: ${leaf}`);
      leaves.push(leaf);
    }
    // (2) Padding
    this.logger.log(`[JS-PROOF] (2) Padding leaves to ${1 << MERKLE_PATH_LEN}`);
    const initialLeafCount = leaves.length;
    while (leaves.length < (1 << MERKLE_PATH_LEN)) {
      const dummy_fr0 = await rustStringToFr("DUMMY");
      const dummy_fr1 = await rustStringToFr("DUMMY");
      const dummy_fr2 = await rustStringToFr(String(leaves.length));
      const dummy_leaf = await rustPoseidonHash([dummy_fr0, dummy_fr1, dummy_fr2]);
      this.logger.log(`[JS-PROOF] Padding with dummy leaf: ${dummy_leaf} (idx=${leaves.length})`);
      leaves.push(dummy_leaf);
    }
    this.logger.log(`[JS-PROOF] Padded leaves count: ${leaves.length}`);
    // (3) Query leaf
    this.logger.log(`[JS-PROOF] (3) Get query leaf for patient: ${queryPatient.patient_id}`);
    const query_leaf = await this.patientLeaf(queryPatient);
    const leaf_idx = leaves.findIndex((x) => x.toLowerCase() === query_leaf.toLowerCase());
    if (leaf_idx === -1) throw new Error("Query patient leaf not found in tree!");
    this.logger.log(`[JS-PROOF] Found query leaf at index: ${leaf_idx}`);
    // (4) Build tree
    this.logger.log(`[JS-PROOF] (4) Building Merkle tree with MERKLE_PATH_LEN=${MERKLE_PATH_LEN}`);
    const levels: string[][] = [leaves];
    let cur = leaves;
    for (let depth = 0; depth < MERKLE_PATH_LEN; depth++) {
      const next: string[] = [];
      this.logger.log(`[JS-MERKLE] Building LEVEL=${depth} with ${cur.length} nodes`);
      for (let i = 0; i < cur.length; i += 2) {
        const left = cur[i], right = cur[i + 1];
        this.logger.log(`[JS-MERKLE]   Hashing: [${i},${i + 1}] left=${left} right=${right}`);
        const parent = await rustPoseidonHash([left, right]);
        this.logger.log(`[JS-MERKLE]   Result: parent=${parent}`);
        next.push(parent);
      }
      levels.push(next);
      cur = next;
    }
    const merkle_root = cur[0];
    this.logger.log(`[JS-MERKLE] Merkle root: ${merkle_root}`);
    // (5) Merkle path
    this.logger.log(`[JS-PROOF] (5) Computing Merkle path for leaf_index=${leaf_idx}`);
    let idx = leaf_idx;
    const path: string[] = [];
    for (let depth = 0; depth < MERKLE_PATH_LEN; depth++) {
      const sibIdx = idx ^ 1;
      const siblingValue = levels[depth][sibIdx];
      path.push(siblingValue);
      this.logger.log(`[JS-MERKLE] LEVEL=${depth} | sibling index: ${sibIdx} value: ${siblingValue}`);
      idx = Math.floor(idx / 2);
    }
    // (6) Manual verification & round-by-round check
    this.logger.log(`[JS-PROOF] (6) Verifying proof path maps to root...`);
    let test_cur = query_leaf;
    for (let i = 0; i < path.length; i++) {
      const sibling = path[i];
      const bit = (leaf_idx >> i) & 1;
      const left  = bit ? sibling : test_cur;
      const right = bit ? test_cur : sibling;
      this.logger.log(`[JS-MERKLE] PROOF CHECK Level=${i} | bit=${bit} | L=${left} | R=${right}`);
      test_cur = await rustPoseidonHash([left, right]);
      this.logger.log(`[JS-MERKLE] PROOF CHECK Level=${i} Result: hash=${test_cur}`);
    }
    const rootMatches = test_cur.toLowerCase() === merkle_root.toLowerCase();
    this.logger.log(`[JS-MERKLE] PROOF CHECK FINAL: leaf_index=${leaf_idx}\n      Final: ${test_cur} \n      Merkle root: ${merkle_root} \n      MATCH: ${rootMatches}`);
    // (7) Collate all debug info as block
    this.logger.log(`[JS-MERKLE] PROOF CONSTRUCTION COMPLETE:`);
    this.logger.log(`--- PROOF DATA ---`);
    this.logger.log(`leaf:        ${query_leaf}`);
    this.logger.log(`path:        [${path.join(',')}]`);
    this.logger.log(`index:       ${leaf_idx}`);
    this.logger.log(`root:        ${merkle_root}`);
    this.logger.log(`path.length: ${path.length}`);
    this.logger.log(`--- END PROOF DATA ---`);
    return {
      merkle_leaf_index: leaf_idx,
      merkle_path: path,
      merkle_root: merkle_root,
    };
  }

  // Merkle proof verification (simulate what the circuit does)
  async verifyMerkleProof(leaf: string, proof: string[], root: string, index: number): Promise<boolean> {
    this.logger.log(`[JS-VERIFY] Verifying proof. leaf=${leaf} root=${root} index=${index} path.length=${proof.length}`);
    let computed = leaf;
    for (let i = 0; i < proof.length; i++) {
      const sibling = proof[i];
      const bit = (index >> i) & 1;
      const left = bit ? sibling : computed;
      const right = bit ? computed : sibling;
      this.logger.log(`[JS-VERIFY] Level=${i} | bit=${bit} | left=${left} | right=${right}`);
      computed = await rustPoseidonHash([left, right]);
      this.logger.log(`[JS-VERIFY] Level=${i} | computed hash: ${computed}`);
    }
    const isValid = computed.toLowerCase() === root.toLowerCase();
    this.logger.log(`[JS-VERIFY] FINAL: computed=${computed} | root=${root} | MATCH=${isValid}`);
    return isValid;
  }

  async testPoseidon(inputs: string[]): Promise<string> {
    const response = await fetch('http://172.29.14.163:8080/test-poseidon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data; // or data.hash, if you return an object from Rust
  }
}