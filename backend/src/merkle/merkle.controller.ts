import { Controller, Post, Body, Get } from '@nestjs/common';
import { MerkleService } from './merkle.service';
import { PatientRow } from './interfaces/merkleTree';
@Controller('merkle')
export class MerkleController {
  constructor(private readonly merkleService: MerkleService) {}
  @Post('test-poseidon')
  async testPoseidon(@Body('inputs') inputs: string[]) {
    return { hash: await this.merkleService.testPoseidon(inputs) };
  }

  @Get('patients')
  async getAllPatientsForMerkleProof(): Promise<PatientRow[]> {
    return [
      /* mock data here, or connect to patientService */
    ];
  }
}