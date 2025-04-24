// src/merkle/merkle.controller.ts
import { Controller, Post, Body, Get } from '@nestjs/common';
import { MerkleService } from './merkle.service';
import { PatientRow } from './interfaces/merkleTree';

@Controller('merkle')
export class MerkleController {
  constructor(private readonly merkleService: MerkleService) {}

  @Post('proof')
  async getMerkleProof(
    @Body() dto: { allPatients: PatientRow[]; queryPatient: PatientRow },
  ) {
    const result = await this.merkleService.getProof(
      dto.allPatients,
      dto.queryPatient,
    );
    // result: { merkle_leaf_index, merkle_path, merkle_root }
  
    function assert32ByteHexArray(name: string, arr: string[]) {
      arr.forEach((h, i) => {
        if (!/^0x[0-9a-fA-F]{64}$/.test(h)) {
          throw new Error(`${name}[${i}] = ${h} is not 32-byte hex`);
        }
      });
    }
  
    assert32ByteHexArray('merkle_path', result.merkle_path);
    if (!/^0x[0-9a-fA-F]{64}$/.test(result.merkle_root))
      throw new Error(`merkle_root ${result.merkle_root} is not 32-byte hex`);
  
    // (No need to re-encode hex; it's already encoded by your getProof!)
    return result;
  }

  @Get('patients')
  async getAllPatientsForMerkleProof(): Promise<PatientRow[]> {
    // Wire up to patientService etc, or mock here.
    return [
      /* ... */
    ];
  }
}
