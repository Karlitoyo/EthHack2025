import { Patient } from './patient.entity';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PatientDataDto } from './dto/patientDataDtos';
import { Hospital } from '../hospitals/hospital.entity';
import { ILike } from 'typeorm';
import { ZkSnarkService } from '../zk-snark/zk-snark.service';
import { MerkleService } from '../merkle/merkle.service';
import { toMerklePatientRow } from '../merkle/utils';

@Injectable()
export class PatientService {
  private baseUrl = 'http://172.29.14.163:8080';

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Hospital)
    private readonly hospitalRepository: Repository<Hospital>,
    private readonly zkSnarkService: ZkSnarkService,
    private readonly merkleManager: MerkleService,
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
          id: p.patientId,
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
    // 1. Find the patient to prove
    const patient = await this.patientRepository.findOne({
      where: { patientId, treatment },
      relations: ['hospital'],
    });
    if (!patient) throw new Error('Patient not found');
    const hospital = patient.hospital;
    if (!hospital || !hospital.hospitalId) throw new Error('Bad hospital');
    // 2. Collect all included patients
    const allPatients = await this.patientRepository.find({ relations: ['hospital'] });
    // 3. Prepare leaf rows
    const patientRows = allPatients
      .map(toMerklePatientRow)
      .filter((row) => row.hospital_id && row.treatment && row.patient_id);
    // 4. The query patient
    const queryPatient = toMerklePatientRow(patient);
    // ---- ensure your MerkleManager is ready ----
    await this.merkleManager.ready; // only needed if using async init (see above)
    // 5. Get Merkle proof
    const proof = await this.merkleManager.getProof(patientRows, queryPatient);
    // 6. Prepare Rust payload
    const payload = {
      ...queryPatient,
      merkle_leaf_index: proof.merkle_leaf_index,
      merkle_path: proof.merkle_path,
      merkle_root: proof.merkle_root,
    };
    console.log(JSON.stringify(payload, null, 2));
    // 7. POST to Rust ZKP microservice
    const rustUrl = `${this.baseUrl}/generate-proof`;
    const response = await fetch(rustUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Rust microservice error: ${response.status}: ${errorBody}`);
    }
    return await response.json();
  }
}
