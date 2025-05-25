export interface ProofRecordResponseDto {
  id: string;
  submitter: string;
  merkleRoot: string;
  preimageCommitment: string;
  proofHash: string; // bytes32
  timestamp: string;
}
