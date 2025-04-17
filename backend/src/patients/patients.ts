import { Patient } from './patient.entity';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PatientDataDto } from './dto/patientDataDtos';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  async createPatient(patientData: PatientDataDto): Promise<Patient> {
    const newPatient = this.patientRepository.create({...patientData});
    console.log('Creating new patient:', newPatient);
    return await this.patientRepository.save(newPatient);
  }
}