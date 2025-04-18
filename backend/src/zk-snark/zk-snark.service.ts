import { Injectable } from '@nestjs/common';
import { ZkSnarkDto } from './dto/zkSnarkDtos';
import { Patient } from '../patients/patient.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class ZkSnarkService {
  private baseUrl = 'http://172.29.14.163:8080';

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Hospital)
    private readonly hospitalRepository: Repository<Hospital>,
  ) {}

  async generateProof(data: ZkSnarkDto): Promise<any> {
    const response = await fetch(`${this.baseUrl}/generate-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify( data ),
    });
    if (!response.ok)
      throw new Error(`Failed to generate proof: ${response.status}`);
    return await response.json();
  }

  // zk-snark.service.ts
  async verifyProof(proof: any): Promise<boolean> {
    if (!proof) throw new Error('Proof required for verification');

    // proof.public_input (directly from Rust backend) is already a byte array (LE)
    if (!proof.public_input || proof.public_input.length !== 32) {
      throw new Error('Public input must be exactly one 32-byte element');
    }

    const proofPayload = {
      proof: proof.proof,
      public_input: proof.public_input, // Directly use as-is
    };

    console.log('Payload sent to backend (Rust verifier):', proofPayload);

    const response = await fetch(`${this.baseUrl}/verify-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proofPayload),
    });

    if (!response.ok)
      throw new Error(`Failed verification: ${response.status}`);

    const responseData = await response.json();
    console.log('Backend Verify Response:', responseData);
    return responseData.valid || false;
  }

  async generateTreatmentProof(patientId: string, treatment: string): Promise<any> {
    const patient = await this.patientRepository.findOne({ where: { id: patientId, treatment } });
    if (!patient) throw new Error('Patient/treatment not found');
    const hospital = await this.hospitalRepository.findOne({ where: { id: patient.hospital.id } });
    if (!hospital) throw new Error('Hospital not found');
  
    // Compose ZK payload
    const zkPayload = {
      hospital_id: hospital.id,
      treatment: treatment,
      patient_id: patient.patientId, // Use patient.patientId (the unique ID used for privacy, not database id)
    };
  
    // Call ZkSnarkService (dependency inject this service!)
    const proof = await this.generateProof(zkPayload);
    return proof; // Forward this proof to the requester
  }
}