import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ZkSnarkService } from './zk-snark.service';
import { ZkSnarkDto } from './dto/zkSnarkDtos';
import { GenerateTreatmentProofDto } from './dto/generateTreatmentDtos';
import { PatientService } from '../patients/patients';
import { HttpException, HttpStatus } from '@nestjs/common';

@Controller('zk-snark')
export class ZkSnarkController {
  constructor(
    private readonly zkSnarkService: ZkSnarkService,
    private readonly patientService: PatientService,
  ) {}

  @Post('generate')
  async generateTreatmentProof(@Body() dto: GenerateTreatmentProofDto) {
    try {
      // Call your patient service which orchestrates the ZK proof generation
      const proof = await this.patientService.generateTreatmentProof(
        dto.patientId,
        dto.treatment,
      );
      // This proof can now be returned to frontend or another service for verification
      return {
        message: 'Proof generated successfully',
        proof,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to generate proof',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('verify-proof')
  async verifyProof(@Body() body: any): Promise<boolean> {
    const proofBytes = body.proof;
    const publicInputBytes = body.public_input;

    if (!publicInputBytes || !Array.isArray(publicInputBytes)) {
      throw new BadRequestException('public_input is missing or invalid');
    }

    console.log('Public Input sent:', publicInputBytes);
    console.log('Proof sent:', proofBytes);

    // Pass the complete proof object to the service
    return this.zkSnarkService.verifyProof({
      proof: Array.from(proofBytes), // <- Make sure explicitly to Array (numeric).
      public_input: Array.from(publicInputBytes), // <- Make sure explicitly to Array (numeric).
    });
  }
}
