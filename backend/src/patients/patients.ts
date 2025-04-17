import { Patient } from './patient.entity';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PatientDataDto } from './dto/patientDataDtos';
import { Hospital } from '../hospitals/hospital.entity';
import { ILike } from 'typeorm';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Hospital)
    private readonly hospitalRepository: Repository<Hospital>,
  ) {}

  async createPatient(patientData: PatientDataDto): Promise<Patient> {
    const newPatient = this.patientRepository.create({...patientData});
    console.log('Creating new patient:', newPatient);
    return await this.patientRepository.save(newPatient);
  }

  // patient.service.ts
async findHospitalsAndPatientsByTreatment(treatment: string) {
  const hospitals = await this.hospitalRepository.find({
    where: { treatment },
  });

  const patients = await this.patientRepository.find({
    where: { treatment },
  });

  // Group patients by hospitalId
  const result = hospitals.map(hospital => {
    const matchingPatients = patients.filter(
      patient => patient.treatment === treatment // Additional filters can go here
    );

    return {
      id: hospital.id,
      name: hospital.name,
      location: hospital.location,
      patients: matchingPatients,
    };
  });

  return {
    treatment,
    hospitals: result,
  };
}


async findPatientsInHospitalsByTreatment(treatment: string) {
  // Find all hospitals offering this treatment
  const hospitals = await this.hospitalRepository.find({
    where: { treatment: ILike(`%${treatment}%`) },
  });

  // Find all patients with this treatment
  const patients = await this.patientRepository.find({
    where: { treatment: ILike(`%${treatment}%`) },
  });

  // Pair hospitals with matching patients
  const result = hospitals.map(hospital => {
    const relatedPatients = patients.filter(
      p => p.treatment?.toLowerCase() === hospital.treatment?.toLowerCase()
    );

    return {
      id: hospital.id,
      name: hospital.name,
      location: hospital.location,
      treatment: hospital.treatment,
      patients: relatedPatients.map(p => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        age: p.age,
        treatment: p.treatment,
      })),
    };
  });

  return {
    treatment,
    hospitals: result,
  };
}
}