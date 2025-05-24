import { Controller, Post, Body, BadRequestException } from '@nestjs/common'; // Removed Logger
import { ZkSnarkService } from './zk-snark.service';
import { VerifyProofDto } from './dto/generateTreatementProofDto'; 
import { GenerateLineageProofDto } from './dto/generateLineageProofDto';
import { GenerateSpecificLinkProofDto } from './dto/generateSpecificLinkProofDto'; // Added import

@Controller('zk-snark')
export class ZkSnarkController {
  constructor(
    private readonly zkSnarkService: ZkSnarkService,
  ) {}

  @Post('generate-proof')
  async generateProof(@Body() dto: GenerateLineageProofDto) {
    console.log(`[ZkSnarkController] generateProof endpoint hit with DTO: ${JSON.stringify(dto)}`); // Changed to console.log
    // Validate the identifier from GenerateLineageProofDto
    if (!dto.identifier) {
      throw new BadRequestException(
        'Missing required field: identifier is required.',
      );
    }
    // Call the unified lineage proof generation service method
    return await this.zkSnarkService.generateLineageProof(dto);
  }

  // // This endpoint is for generating a proof for a specific, user-provided link (ancestor, relationship, descendant)
  // @Post('generate-specific-link-proof')
  // async generateSpecificLinkProof(@Body() dto: GenerateSpecificLinkProofDto) {
  //   return await this.zkSnarkService.generateSpecificLinkProof(dto);
  // }

  // @Post('generate-lineage-proof') // This endpoint remains as is, now functionally identical to /generate-proof
  // async generateLineageProof(@Body() dto: GenerateLineageProofDto) {
  //   if (!dto.identifier) {
  //     throw new BadRequestException('Missing required field: identifier is required.');
  //   }
  //   return await this.zkSnarkService.generateLineageProof(dto);
  // }

  @Post('verify-proof')
  async verifyProof(@Body() dto: VerifyProofDto) {
    console.log(`[ZkSnarkController] verifyProof endpoint hit with DTO: ${JSON.stringify(dto)}`); // Changed to console.log
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