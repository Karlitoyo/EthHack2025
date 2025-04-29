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
    proof: number[] | Uint8Array;
    public_inputs: (number[] | Uint8Array)[];
}) {
    if (public_inputs.length !== 2)
        throw new Error('Expected exactly 2 public inputs');
    public_inputs.forEach((input, i) => {
        if (input.length !== 32)
            throw new Error(`Public input ${i} must be 32 bytes, got ${input.length}`);
    });
    const res = await fetch(`${this.baseUrl}/verify-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            proof: Array.from(proof),
            public_inputs: public_inputs.map(input => Array.from(input))
        }),
    });
    if (!res.ok) {
        throw new Error(`[ZKP-VERIFY] Error from Rust service: ${await res.text()}`);
    }
    return await res.json();
}
}
