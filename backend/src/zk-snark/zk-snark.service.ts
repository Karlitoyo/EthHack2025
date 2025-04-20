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

  async generateProof(payload: { hospital_id: string, treatment: string, patient_id: string }) {
    const res = await fetch(`${this.baseUrl}/generate-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`ZKP proof generation error: ${res.status}`);
    return res.json();
  }

  // zk-snark.service.ts
  async verifyProof({proof, public_input}: {proof: number[], public_input: number[]}) {
    const res = await fetch(`${this.baseUrl}/verify-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({proof, public_input}),
    });
    if (!res.ok) throw new Error(`ZKP verification error: ${res.status}`);
    return res.json();
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