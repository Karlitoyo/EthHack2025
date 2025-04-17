import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ZkSnarkService } from './zk-snark.service';
import { ZkSnarkDto } from './dto/zkSnarkDtos';

@Controller('zk-snark')
export class ZkSnarkController {
  constructor(private readonly zkSnarkService: ZkSnarkService) {}

  @Post('generate')
  async generateProof(@Body('data') data: ZkSnarkDto): Promise<any> {
    return this.zkSnarkService.generateProof(data);
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
      proof: Array.from(proofBytes),                    // <- Make sure explicitly to Array (numeric).
      public_input: Array.from(publicInputBytes), // <- Make sure explicitly to Array (numeric).
    });
  }
}
