import { Injectable } from '@nestjs/common';
import { ethers, BigNumberish } from 'ethers'; // Added BigNumberish
import * as abi from '../../abi/ZKProofLog.json';

// Define an interface for the ProofRecord struct
export interface ProofRecord { // Added export
  id: bigint;
  submitter: string;
  merkleRoot: bigint;
  preimageCommitment: bigint;
  proofHash: string; // bytes32
  timestamp: bigint;
}

@Injectable()
export class ZkProofLogService {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private contract: ethers.Contract;

  constructor() {
    const privateKey = process.env.PRIVATE_KEY;

    this.provider = new ethers.JsonRpcProvider(process.env.ETH_PROVIDER_URL);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(
      process.env.ZK_PROOF_LOG_CONTRACT,
      abi.abi,
      this.signer
    );
  }

  /**
   * Submits proof to blockchain
   * @param proof      - The proof (as hex string, e.g., '0x...'), can be bytes object
   * @param merkleRoot - BigNumber/string/number (uint256)
   * @param preimageCommitment - BigNumber/string/number (uint256)
   */
  async submitProof(
    proof: string, 
    merkleRoot: string | number | BigNumberish, // Updated type to include BigNumberish for consistency
    preimageCommitment: string | number | BigNumberish // Updated type to include BigNumberish for consistency
  ) {
    // proof should be hex string; merkleRoot/preimageCommitment should be uint256 or BN/string
    const tx = await this.contract.submitProof(proof, merkleRoot, preimageCommitment);
    await tx.wait(); // Optional: Wait for confirmation
    return tx.hash;
  }

  /**
   * Get the total number of proofs submitted.
   * @returns The total count of proof records as a bigint.
   */
  async getProofRecordsCount(): Promise<bigint> {
    return this.contract.getProofRecordsCount();
  }

  /**
   * Get a specific proof record by its ID.
   * @param proofId The ID of the proof record to retrieve.
   * @returns The ProofRecord object.
   */
  async getProofRecordById(proofId: BigNumberish): Promise<ProofRecord> {
    const record = await this.contract.getProofRecordById(proofId);
    // Convert array result from contract call to a structured ProofRecord object
    return {
        id: BigInt(record.id),
        submitter: record.submitter,
        merkleRoot: BigInt(record.merkleRoot),
        preimageCommitment: BigInt(record.preimageCommitment),
        proofHash: record.proofHash,
        timestamp: BigInt(record.timestamp)
    };
  }

  /**
   * Get all proof records submitted by a specific address.
   * @param submitterAddress The address of the submitter.
   * @return An array of ProofRecord objects.
   */
  async getProofRecordsBySubmitter(submitterAddress: string): Promise<ProofRecord[]> {
    const recordsArray = await this.contract.getProofRecordsBySubmitter(submitterAddress);
    // Convert array of array results from contract call to an array of structured ProofRecord objects
    return recordsArray.map(record => ({
        id: BigInt(record.id),
        submitter: record.submitter,
        merkleRoot: BigInt(record.merkleRoot),
        preimageCommitment: BigInt(record.preimageCommitment),
        proofHash: record.proofHash,
        timestamp: BigInt(record.timestamp)
    }));
  }
}