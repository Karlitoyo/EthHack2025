import { Injectable } from '@nestjs/common';

@Injectable()
export class ZkSnarkService {

  async generateProof(payload: {
    // Field names match the Rust ZKP service's ProofRequest struct
    hospital_id: string;      // Semantically: ancestor_id
    treatment: string;        // Semantically: relationship_type
    patient_id: string;       // Semantically: descendant_id
    merkle_leaf_index: number; // Corresponds to u64 in Rust
    merkle_path: string[];      // Array of hex strings
    merkle_root: string;        // Hex string
  }) {
    const res = await fetch(`${process.env.ZKP_SERVICE_URL}/generate-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), // Send the complete payload
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
    const res = await fetch(`${process.env.ZKP_SERVICE_URL}/verify-proof`, {
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
