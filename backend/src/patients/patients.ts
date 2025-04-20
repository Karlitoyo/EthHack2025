import { Patient } from './patient.entity';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PatientDataDto } from './dto/patientDataDtos';
import { Hospital } from '../hospitals/hospital.entity';
import { ILike } from 'typeorm';
import { ZkSnarkService } from '../zk-snark/zk-snark.service';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Hospital)
    private readonly hospitalRepository: Repository<Hospital>,
    private readonly zkSnarkService: ZkSnarkService,
  ) {}

  async createPatient(createPatientDto: PatientDataDto): Promise<Patient> {
    const { treatment } = createPatientDto;

    // Find a hospital that provides this treatment
    const matchingHospital = await this.hospitalRepository.findOne({
      where: { treatment: ILike(`%${treatment}%`) },
    });

    // Create the patient and assign hospital if found
    const patient = this.patientRepository.create({
      ...createPatientDto,
      hospital: matchingHospital || null,
    });

    return this.patientRepository.save(patient);
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
    const result = hospitals.map((hospital) => {
      const matchingPatients = patients.filter(
        (patient) => patient.treatment === treatment, // Additional filters can go here
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
    const result = hospitals.map((hospital) => {
      const relatedPatients = patients.filter(
        (p) => p.treatment?.toLowerCase() === hospital.treatment?.toLowerCase(),
      );

      return {
        id: hospital.id,
        name: hospital.name,
        location: hospital.location,
        treatment: hospital.treatment,
        patients: relatedPatients.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          age: p.age,
          email: p.email,
          address: p.address,
          phone: p.contactNumber,
          treatment: p.treatment,
        })),
      };
    });

    return {
      treatment,
      hospitals: result,
    };
  }

async generateTreatmentProof(patientId: string, treatment: string) {
  const patient = await this.patientRepository.findOne({
    where: { patientId: patientId, treatment },
    relations: ['hospital'],
  });
  if (!patient) throw new Error('Patient/treatment not found');
  const hospital = patient.hospital;
  if (!hospital) throw new Error('Hospital not found for patient');
  if (!hospital.hospitalId)
    throw new Error(
      'hospital.hospitalId missing: use a privacy-safe unique identifier (not DB pk) as public field for ZKP input'
    );

  // Compose proof input with pseudo-anonymous IDs
  const proofPayload = {
    hospital_id: hospital.hospitalId,    // <-- use the public, privacy-safe id
    treatment,
    patient_id: patient.patientId,       // use privacy-preserving ID
  };
  const proof = await this.zkSnarkService.generateProof(proofPayload);
  return proof;
}
}
