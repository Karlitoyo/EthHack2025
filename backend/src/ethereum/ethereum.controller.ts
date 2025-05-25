import { Controller, Post, Body, Get, Param, BadRequestException } from '@nestjs/common';
import { ZkProofLogService, ProofRecord } from './ethereum.service';
import { ethers, BigNumberish } from 'ethers';
import { ProofRecordResponseDto } from './dto/proof-record-response.dto'; // Import DTO

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
    public_inputs: [string | number[], string | number[]]; // Kept specific types for what is received
  }) {
    if (!body.public_inputs || body.public_inputs.length !== 2) {
      throw new BadRequestException('public_inputs must be an array of two elements.');
    }

    const merkleRootU256 = toBigIntFromHexOrArray(body.public_inputs[0]);
    const preimageCommitmentU256 = toBigIntFromHexOrArray(body.public_inputs[1]);
    const normalizedProof = normalizeBytesLike(body.proof);

    const txHash = await this.zkProofLogService.submitProof(
      normalizedProof, // always "0x..."
      ethers.toBeHex(merkleRootU256),
      ethers.toBeHex(preimageCommitmentU256)
    );
    // Serialize BigInts to strings for JSON response if not automatically handled
    // For now, assume NestJS handles BigInt serialization or client handles parsing
    return {
      status: 'submitted',
      transactionHash: txHash,
      etherscanUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
    };
  }

  @Get('/proofs/count')
  async getProofRecordsCount(): Promise<{ count: string }> {
    const count = await this.zkProofLogService.getProofRecordsCount();
    return { count: count.toString() };
  }

  @Get('/proofs/id/:proofId')
  async getProofRecordById(@Param('proofId') proofId: string): Promise<ProofRecordResponseDto | null> { // Use DTO
    try {
      const record = await this.zkProofLogService.getProofRecordById(BigInt(proofId)); 
      return {
        id: record.id.toString(),
        submitter: record.submitter,
        merkleRoot: record.merkleRoot.toString(),
        preimageCommitment: record.preimageCommitment.toString(),
        proofHash: record.proofHash,
        timestamp: record.timestamp.toString(),
      };
    } catch (error) {
      console.error(`Error fetching proof by ID ${proofId}:`, error);
      return null; 
    }
  }

  @Get('/proofs/submitter/:submitterAddress')
  async getProofRecordsBySubmitter(@Param('submitterAddress') submitterAddress: string): Promise<ProofRecordResponseDto[]> { // Use DTO
    if (!ethers.isAddress(submitterAddress)) {
        throw new BadRequestException("Invalid submitter address format");
    }
    const records = await this.zkProofLogService.getProofRecordsBySubmitter(submitterAddress);
    return records.map(record => ({
        id: record.id.toString(),
        submitter: record.submitter,
        merkleRoot: record.merkleRoot.toString(),
        preimageCommitment: record.preimageCommitment.toString(),
        proofHash: record.proofHash,
        timestamp: record.timestamp.toString(),
    }));
  }
}