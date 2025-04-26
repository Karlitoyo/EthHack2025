// import * as circomlibjs from 'circomlibjs';
// import {
//   stringToFrBigInt,
//   toHex32Buf,
//   bigIntToBuffer,
//   ensureBigInt,
//   recalcMerkleRoot,
// } from './utils';
// import { PatientRow } from './interfaces/merkleTree';
// import { MERKLE_PATH_LEN } from './constants/constants';

// export class MerkleManager {
//   poseidon: typeof circomlibjs.poseidon;
//   ready: Promise<any>;
//   constructor(poseidon?: typeof circomlibjs.poseidon) {
//     this.ready = (
//       poseidon ? Promise.resolve(poseidon) : circomlibjs.buildPoseidon()
//     ).then((p) => (this.poseidon = p));
//   }
//   // Computes the Poseidon-based leaf node (matches Rust circuit)
//   async patientLeaf(row: PatientRow): Promise<bigint> {
//     await this.ready;
//     console.log('patientLeaf', row);
//     if (typeof row.hospital_id !== 'string') {
//       console.error(
//         'hospital_id is not a string:',
//         row.hospital_id,
//         typeof row.hospital_id,
//       );
//     }
//     if (typeof row.treatment !== 'string') {
//       console.error(
//         'treatment is not a string:',
//         row.treatment,
//         typeof row.treatment,
//       );
//     }
//     if (typeof row.patient_id !== 'string') {
//       console.error(
//         'patient_id is not a string:',
//         row.patient_id,
//         typeof row.patient_id,
//       );
//     }
//     const fields = [
//       stringToFrBigInt(row.hospital_id),
//       stringToFrBigInt(row.treatment),
//       stringToFrBigInt(row.patient_id),
//     ];
//     console.log('patientLeaf fields', fields);
//     return ensureBigInt(this.poseidon(fields));
//   }
//   // Main API: returns all proof ingredients as 0x hex strings for /generate-proof
//   async getProof(
//     allPatients: PatientRow[],
//     queryPatient: PatientRow,
//   ): Promise<{
//     merkle_root: string; // 0x-prefixed hex
//     merkle_path: string[]; // array of 0x-prefixed hex strings
//     merkle_leaf_index: number; // index of the patient leaf
//     commitment: string; // for display: leaf commitment in 0x hex
//   }> {
//     await this.ready;
//     // Build all leaves (power of two, fill dummy as needed)
//     let leaves: bigint[] = await Promise.all(
//       allPatients.map((p) => this.patientLeaf(p)),
//     );
//     console.log('leaves', leaves);
//     const height = MERKLE_PATH_LEN; // adjust to match proof/circuit/params!
//     while (leaves.length < 1 << height) {
//       leaves.push(
//         ensureBigInt(
//           this.poseidon([
//             stringToFrBigInt('DUMMY'),
//             stringToFrBigInt('DUMMY'),
//             stringToFrBigInt(String(leaves.length)),
//           ]),
//         ),
//       );
//     }
//     // Find the index of the query patient
//     const queryHash = await this.patientLeaf(queryPatient);
//     const index = leaves.findIndex((l) => l === queryHash);
//     if (index === -1)
//       throw new Error('Query patient not found in set (Merkle leaf)');
//     // Build tree levels
//     const levels: bigint[][] = [leaves];
//     let current = leaves;
//     for (let d = 0; d < height; d++) {
//       const next: bigint[] = [];
//       for (let i = 0; i < current.length; i += 2) {
//         next.push(
//           ensureBigInt(
//             this.poseidon([
//               ensureBigInt(current[i]),
//               ensureBigInt(current[i + 1]),
//             ]),
//           ),
//         );
//       }
//       levels.push(next);
//       current = next;
//     }
//     const root = current[0];
//     // Sibling path, bottom-up
//     let idx = index;
//     const path: bigint[] = [];
//     for (let d = 0; d < height; d++) {
//       const sibIdx = idx ^ 1;
//       path.push(levels[d][sibIdx]);
//       idx = Math.floor(idx / 2);
//     }

//     const leafHash = await this.patientLeaf(queryPatient);
//     const recalcRoot = recalcMerkleRoot(leafHash, path, index, this.poseidon);

//     console.log(`Original Tree Root:   0x${root.toString(16)}`);
//     console.log(`Recomputed from path: 0x${recalcRoot.toString(16)}`);
//     console.log('Roots match?', root === recalcRoot);
//     const p = await this.getProof(allPatients, queryPatient);
//     // verify recompute
//     const leafBig = await this.patientLeaf(queryPatient);
//     const pathBigs = p.merkle_path.map((h) =>
//       ensureBigInt('0x' + h.replace(/^0x/, '')),
//     );
//     const rootBig = ensureBigInt('0x' + p.merkle_root.replace(/^0x/, ''));
//     const rootFromPath = recalcMerkleRoot(
//       leafBig,
//       pathBigs,
//       p.merkle_leaf_index,
//       this.poseidon,
//     );
//     console.log('root:         ', toHex32Buf(bigIntToBuffer(rootBig)));
//     console.log('rootFromPath: ', toHex32Buf(bigIntToBuffer(rootFromPath)));
//     console.log('MATCH?', rootBig === rootFromPath); // Should be true!
//     // Output as 0x-hex
//     return {
//       merkle_root: toHex32Buf(bigIntToBuffer(root)),
//       merkle_path: path.map((bi) => toHex32Buf(bigIntToBuffer(bi))),
//       merkle_leaf_index: index,
//       commitment: toHex32Buf(bigIntToBuffer(queryHash)),
//     };
//   }
// }
