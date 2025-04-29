import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import abi from '../../../ethereum/src/abi/ZKProofLog.json'; // Adjust the path to your ABI file

@Injectable()
export class ZkProofLogService {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private contract: ethers.Contract;
  
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.ETH_PROVIDER_URL);
    this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    this.contract = new ethers.Contract(
      process.env.ZK_PROOF_LOG_CONTRACT, 
      abi.abi, // Access the abi property from the imported JSON
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
    merkleRoot: string | number, 
    preimageCommitment: string | number
  ) {
    // proof should be hex string; merkleRoot/preimageCommitment should be uint256 or BN/string
    const tx = await this.contract.submitProof(proof, merkleRoot, preimageCommitment);
    await tx.wait(); // Optional: Wait for confirmation
    return tx.hash;
  }
}