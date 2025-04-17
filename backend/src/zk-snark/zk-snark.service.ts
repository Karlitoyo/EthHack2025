import { Injectable } from '@nestjs/common';
import { ZkSnarkDto } from './dto/zkSnarkDtos';

@Injectable()
export class ZkSnarkService {
  private baseUrl = 'http://172.29.14.163:8080';

  async generateProof(data: ZkSnarkDto): Promise<any> {
    const response = await fetch(`${this.baseUrl}/generate-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    if (!response.ok)
      throw new Error(`Failed to generate proof: ${response.status}`);
    return await response.json();
  }

  async generateProofWithInput(input: number): Promise<any> {
    const response = await fetch(`${this.baseUrl}/generate-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
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
}
