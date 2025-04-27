import { Injectable } from '@nestjs/common';
import { Patient } from '../patients/patient.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { MerkleService } from 'src/merkle/merkle.service';
import { assertIs32ByteHex } from 'src/merkle/utils';

@Injectable()
export class ZkSnarkService {
  private baseUrl = 'http://172.29.14.163:8080';

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Hospital)
    private readonly hospitalRepository: Repository<Hospital>,
    private readonly merkleService: MerkleService,
  ) {}

  async generateProof(payload: {
    hospital_id: string;
    treatment: string;
    patient_id: string;
  }) {
    const res = await fetch(`${this.baseUrl}/generate-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`ZKP proof generation error: ${res.status}`);
    return res.json();
  }

  async verifyProof({
    proof,
    public_inputs,
  }: {
    proof: number[];
    public_inputs: number[][];
  }) {
    const res = await fetch(`${this.baseUrl}/verify-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof, public_inputs }),
    });
    // ...logging etc.
    if (!res.ok) throw new Error(`ZKP verification error: ${res.status}`);
    console.log(
      'Sending payload to Rust microservice:',
      JSON.stringify(res)
    );
    return res.json();
  }

  async generateTreatmentProof(payload: {
    hospital_id: string;
    treatment: string;
    patient_id: string;
    merkle_leaf_index: number;
    merkle_path: string[];
    merkle_root: string;
  }) {
    // --- VALIDATE payload ----
    payload.merkle_path.forEach((h, i) =>
      assertIs32ByteHex(`merkle_path[${i}]`, h),
    );
    assertIs32ByteHex('merkle_root', payload.merkle_root);

    const rustUrl = `${this.baseUrl}/generate-proof`;
    const response = await fetch(rustUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log(JSON.stringify(payload, null, 2));
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Rust microservice error: ${response.status}: ${err}`);
    }
    console.log(
      'Sending payload to Rust microservice:',
      JSON.stringify(response)
    );
    // JSON result contains ZK proof and public input
    return await response.json();
  }
}
