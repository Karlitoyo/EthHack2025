import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ZkSnarkService } from './zk-snark.service';
// Updated DTO import to use GenerateSimpleProofDto
import { GenerateSimpleProofDto, VerifyProofDto } from './dto/generateTreatementProofDto';
import { RelationService } from '../relation/relation'; // Import CitizenService (corrected path)

@Controller('zk-snark')
export class ZkSnarkController {
  constructor(
    private readonly zkSnarkService: ZkSnarkService,
    private readonly citizenService: RelationService, // Inject CitizenService
  ) {}

  @Post('generate-proof')
  // DTO type updated to GenerateSimpleProofDto
  async generateProof(@Body() dto: GenerateSimpleProofDto) {
    // Validate the simplified DTO
    if (!dto.descendantId || !dto.relationshipType || !dto.ancestorId) {
      throw new BadRequestException(
        'Missing required fields: descendantId, relationshipType, and ancestorId are required.',
      );
    }

    // 1. Call CitizenService to get all necessary inputs for ZKP
    const proofInputs = await this.citizenService.prepareLineageProofInputs(
      dto.descendantId, 
      dto.relationshipType,
    );
    
    // Validate that the user-provided ancestorId matches the one derived from the descendant and relationshipType
    if (dto.ancestorId !== proofInputs.hospital_id) {
        throw new BadRequestException(
            `The provided ancestorId ('${dto.ancestorId}') does not match the actual ancestorId ('${proofInputs.hospital_id}') derived for the descendant ('${dto.descendantId}') with relationship ('${dto.relationshipType}'). Please verify the input data.`
        );
    }

    // 2. Call the ZkSnarkService with the data prepared by CitizenService
    return await this.zkSnarkService.generateProof(proofInputs);
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