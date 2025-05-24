export class GenerateSimpleProofDto {
    // Renaming to reflect that the backend will now derive Merkle components
    ancestorId: string;       // User-provided ID for the ancestor (e.g., grandfather)
    relationshipType: string; // User-provided relationship (e.g., child_of)
    descendantId: string;     // User-provided ID for the descendant (e.g., son)
}

// Keeping VerifyProofDto as is, as the proof structure itself doesn't change
export class VerifyProofDto {
  proof: number[];
  public_inputs: number[][];
}