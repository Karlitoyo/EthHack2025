import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { Patient } from './patient.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientService } from './patients';

@Module({
  imports: [TypeOrmModule.forFeature([Patient])],
  providers: [PatientService],
  exports: [PatientService],
  controllers: [PatientsController],
})
export class PatientsModule {}
