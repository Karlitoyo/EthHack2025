import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ZkSnarkService } from './zk-snark.service';
import { CitizenService } from '../citizen/citizen';
import { GenerateTreatmentProofDto, VerifyProofDto } from './dto/generateTreatementProofDto';

@Controller('zk-snark')
export class ZkSnarkController {
  constructor(
    private readonly zkSnarkService: ZkSnarkService,
    private readonly citizenService: CitizenService
  ) {}

  @Post('generate-proof')
  async generateProof(@Body() dto: GenerateTreatmentProofDto) {
    if (!dto.patientId || !dto.treatment) {
      throw new BadRequestException('patientId, treatment, and hospitalId are required');
    }
    // Call the service as before
    return await this.citizenService.generateTreatmentProof(dto.patientId, dto.treatment);
  }

  @Post('verify-proof')
  async verifyProof(@Body() dto: VerifyProofDto) {
    if (!Array.isArray(dto.public_inputs) || dto.public_inputs.length !== 2) {
      throw new BadRequestException('public_inputs must be a 2-element array');
    }
    if (
      !Array.isArray(dto.public_inputs[0]) ||
      dto.public_inputs[0].length !== 32 ||
      !Array.isArray(dto.public_inputs[1]) ||
      dto.public_inputs[1].length !== 32
    ) {
      throw new BadRequestException('Each element of public_inputs must be 32 bytes');
    }
    return await this.zkSnarkService.verifyProof(dto); // Pass-through to ZKP service
  }
}