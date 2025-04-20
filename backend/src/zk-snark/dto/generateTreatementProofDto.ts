export class GenerateTreatmentProofDto {
    patientId: string;
    treatment: string;
  }
  
  // dto/verify-proof.dto.ts
  export class VerifyProofDto {
    proof: number[];
    public_input: number[];
  }