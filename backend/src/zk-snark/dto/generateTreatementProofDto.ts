export class GenerateTreatmentProofDto {
    patientId: string;
    treatment: string;
  }
  
  export class VerifyProofDto {
    proof: number[];
    public_inputs: number[][]; // WAS: public_input: number[];
  }