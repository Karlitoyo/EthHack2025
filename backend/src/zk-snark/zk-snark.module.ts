// zk-snark.module.ts
import { Module } from '@nestjs/common';
import { ZkSnarkService } from './zk-snark.service';
import { ZkSnarkController } from './zk-snark.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../patients/patient.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { PatientService } from 'src/patients/patients';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, Hospital]),
  ],
  providers: [ZkSnarkService, PatientService],
  controllers: [ZkSnarkController],
  exports: [ZkSnarkService],    
})
export class ZkSnarkModule {}