import { Controller, Post, Body } from '@nestjs/common';
import { ZkProofLogService } from './ethereum.service';
import { ethers } from 'ethers';

function arrayToHex(arr: number[]): string {
    return "0x" + Buffer.from(arr).toString('hex');
}

function toBigIntFromHexOrArray(input: string | number[]): bigint {
    if (typeof input === "string") {
      return ethers.toBigInt(input);
    }
    return ethers.toBigInt(arrayToHex(input));
}

function normalizeBytesLike(input: string | number[]): string {
    if (typeof input === "string") {
      if (input.startsWith("0x")) return input;
      throw new Error("proof string must be 0x hex");
    }
    return arrayToHex(input);
}

@Controller('ethereum')
export class ZkProofLogController {
  constructor(private readonly zkProofLogService: ZkProofLogService) {}

  @Post('/submit')
  async submitProof(@Body() body: {
    proof: string | number[];
    public_inputs: [string | number[], string | number[]];
  }) {
    const merkleRootU256 = toBigIntFromHexOrArray(body.public_inputs[0]);
    const preimageCommitmentU256 = toBigIntFromHexOrArray(body.public_inputs[1]);
    const normalizedProof = normalizeBytesLike(body.proof);

    const txHash = await this.zkProofLogService.submitProof(
      normalizedProof, // always "0x..."
      ethers.toBeHex(merkleRootU256),
      ethers.toBeHex(preimageCommitmentU256)
    );
    return {
      status: 'submitted',
      transactionHash: txHash,
      etherscanUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
    };
  }
}