// zk-snark.module.ts
import { Module } from '@nestjs/common';
import { ZkSnarkService } from './zk-snark.service';
import { ZkSnarkController } from './zk-snark.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../patients/patient.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { PatientService } from 'src/patients/patients';
import { MerkleService } from '../merkle/merkle.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, Hospital]),
  ],
  providers: [ZkSnarkService, PatientService, MerkleService],
  controllers: [ZkSnarkController],
  exports: [ZkSnarkService],    
})
export class ZkSnarkModule {}