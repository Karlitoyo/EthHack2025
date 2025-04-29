import { Patient } from './patient.entity';
import { Repository } from 'typeorm';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'; // Import NotFoundException and ConflictException
import { InjectRepository } from '@nestjs/typeorm';
import { PatientDataDto } from './dto/patientDataDtos';
import { Hospital } from '../hospitals/hospital.entity';
import { ILike } from 'typeorm';
import { MerkleService } from '../merkle/merkle.service'; // adjust the import!
import { toMerklePatientRow } from '../merkle/utils';
import { MERKLE_PATH_LEN } from '../merkle/constants/constants';
@Injectable()
export class PatientService {
  private baseUrl = 'http://172.29.14.163:8080';

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Hospital)
    private readonly hospitalRepository: Repository<Hospital>,
    private readonly merkleManager: MerkleService,
  ) {}

  async createPatient(createPatientDto: PatientDataDto): Promise<Patient> {
    const { patientId, treatment } = createPatientDto;

    // Check if a patient with the same ID already exists
    const existingPatient = await this.patientRepository.findOne({
      where: { patientId },
    });

    if (existingPatient) {
      // Throw ConflictException (HTTP 409)
      throw new ConflictException(`Patient with ID "${patientId}" already exists.`);
    }

    // Find a hospital that provides this treatment
    const matchingHospital = await this.hospitalRepository.findOne({
      where: { treatment: ILike(`%${treatment}%`) },
    });

    // Check if a hospital offering the treatment was found
    if (!matchingHospital) {
      // Throw NotFoundException (HTTP 404)
      throw new NotFoundException(
        `Treatment "${treatment}" not found in any hospital. Patient cannot be created. Please ensure the treatment exists.`,
      );
    }

    // Create the patient and assign the found hospital
    const patient = this.patientRepository.create({
      ...createPatientDto,
      hospital: matchingHospital, // Assign the found hospital
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
    console.log(
      `[START] generateTreatmentProof for patientId=${patientId}, treatment=${treatment}`,
    );

    // 1. Find the patient to prove
    console.log(
      `[1] Finding patient with ID=${patientId} and treatment=${treatment}`,
    );
    const patient = await this.patientRepository.findOne({
      where: { patientId, treatment },
      relations: ['hospital'],
    });
    if (!patient) {
      console.error(
        `[ERROR] Patient not found with ID=${patientId} and treatment=${treatment}`,
      );
      throw new Error('Patient not found');
    }
    console.log(`[1] Found patient: ${patient.firstName} ${patient.lastName}`);

    const hospital = patient.hospital;
    if (!hospital || !hospital.hospitalId) {
      console.error(
        '[ERROR] Patient has invalid hospital assignment:',
        hospital,
      );
      throw new Error('Bad hospital');
    }
    console.log(
      `[1] Hospital verified: ${hospital.name} (ID: ${hospital.hospitalId})`,
    );

    // 2. Collect all included patients
    console.log('[2] Collecting all patients for Merkle tree');
    const allPatients = await this.patientRepository.find({
      relations: ['hospital'],
    });
    console.log(`[2] Found ${allPatients.length} total patients`);

    // 3. Prepare leaf rows
    console.log('[3] Preparing Merkle tree leaf rows');
    const patientRows = allPatients
      .map(toMerklePatientRow)
      .filter((row) => row.hospital_id && row.treatment && row.patient_id);
    console.log(
      `[3] Generated ${patientRows.length} valid leaf rows (filtered from ${allPatients.length} total)`,
    );

    // 4. The query patient
    console.log('[4] Converting query patient to Merkle format');
    const queryPatient = toMerklePatientRow(patient);
    console.log(
      '[4] Query patient data:',
      JSON.stringify(queryPatient, null, 2),
    );

    // ---- ensure your MerkleManager is ready ----
    console.log('[5] Waiting for MerkleManager to be ready');
    await this.merkleManager.ready; // only needed if using async init (see above)
    console.log('[5] MerkleManager is ready');

    // 5. Get Merkle proof
    console.log('[5] Generating Merkle proof');
    const proof = await this.merkleManager.getProof(patientRows, queryPatient);
    console.log('[5] Merkle proof generated successfully');
    console.log('[Root]', proof.merkle_root);
    console.log('[Path]', proof.merkle_path);
    // console.log('[Commitment]', proof.commitment);
    console.log('[Leaf]', proof.merkle_leaf_index);
    // console.log('[Public Inputs]', proof.public_inputs);
    console.log(
      'Sending to generateProof. Path len:',
      proof.merkle_path.length,
      proof.merkle_path,
    );

    if (proof.merkle_path.length !== MERKLE_PATH_LEN) {
      console.error(
        `[ERROR] Invalid Merkle path length: ${proof.merkle_path.length}, expected: ${MERKLE_PATH_LEN}`,
      );
      throw new Error('BUG: backend is about to send a bad path length!');
    }
    console.log('[5] Merkle path length verified');
    // --- BEGIN DETAILED PATH & ROOT DIAGNOSTIC ---
    console.log('[JS-ZKP] --- PATH & ROOT DIAGNOSTIC ---');
    console.log(`[JS-ZKP] Merkle root (hex): ${proof.merkle_root}`);
    (function showHexAndBytes(hex: string, label = '') {
      const h = hex.startsWith('0x') ? hex.slice(2) : hex;
      const arr = Buffer.from(h, 'hex');
      const byteString = Array.from(arr)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      console.log(`${label}${hex} | bytes [${byteString}]`);
    })(proof.merkle_root, '[JS-ZKP] Merkle root: ');

    // Path
    console.log(`[JS-ZKP] Merkle path (length=${proof.merkle_path.length}):`);
    proof.merkle_path.forEach((node, i) => {
      (function (hex: string, idx: number) {
        const h = hex.startsWith('0x') ? hex.slice(2) : hex;
        const arr = Buffer.from(h, 'hex');
        const byteString = Array.from(arr)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ');
        console.log(`[JS-ZKP]   path[${idx}]: ${hex} | bytes [${byteString}]`);
      })(node, i);
    });
    console.log('[JS-ZKP] --- END PATH & ROOT DIAGNOSTIC ---');
    // 6. Prepare Rust payload
    console.log('[6] Preparing payload for Rust ZKP service');
    const payload = {
      ...queryPatient,
      merkle_leaf_index: proof.merkle_leaf_index,
      merkle_path: proof.merkle_path,
      merkle_root: proof.merkle_root,
      // public_inputs: proof.public_inputs,
    };
    console.log('[6] Rust ZKP payload:', JSON.stringify(payload, null, 2));

    // 7. POST to Rust ZKP microservice
    const rustUrl = `${this.baseUrl}/generate-proof`;
    console.log(`[7] Sending POST request to ${rustUrl}`);
    const response = await fetch(rustUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log(`[7] Response status: ${response.status}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `[ERROR] Rust microservice error: ${response.status}: ${errorBody}`,
      );
      throw new Error(
        `Rust microservice error: ${response.status}: ${errorBody}`,
      );
    }

    const result = await response.json();
    console.log('[COMPLETE] Successfully generated ZKP proof');
    return result;
  }
}
