import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { Patient } from './patient.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientService } from './patients';
import { Hospital } from '../hospitals/hospital.entity';
import { ZkSnarkService } from '../zk-snark/zk-snark.service';
import { MerkleService } from '../merkle/merkle.service';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, Hospital])],
  providers: [PatientService, ZkSnarkService, MerkleService],
  exports: [PatientService],
  controllers: [PatientsController],
})
export class PatientsModule {}
