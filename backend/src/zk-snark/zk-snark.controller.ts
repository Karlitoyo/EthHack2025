import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ZkSnarkService } from './zk-snark.service';
import { GenerateTreatmentProofDto, VerifyProofDto } from './dto/generateTreatementProofDto';
import { PatientService } from '../patients/patients';

@Controller('zk-snark')
export class ZkSnarkController {
  constructor(
    private readonly zkSnarkService: ZkSnarkService,
    private readonly patientService: PatientService,
  ) {}

  @Post('generate-proof')
  async generateProof(@Body() dto: GenerateTreatmentProofDto) {
    if (!dto.patientId || !dto.treatment) {
      throw new BadRequestException('patientId and treatment are required');
    }
    return await this.patientService.generateTreatmentProof(dto.patientId, dto.treatment);
  }

  @Post('verify-proof')
  async verifyProof(@Body() dto: VerifyProofDto) {
    if (!dto.proof || !dto.public_input) {
      throw new BadRequestException('Proof and public input are required');
    }
    if (dto.public_input.length !== 32) {
      throw new BadRequestException('Public input must be exactly one 32-byte element');
    }
    return await this.zkSnarkService.verifyProof(dto); // Pass-through to ZKP service
  }
}
