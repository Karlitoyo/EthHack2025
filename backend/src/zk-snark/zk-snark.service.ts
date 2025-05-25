import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'; // Removed Logger
import { RelationService, LineageResponse } from '../relation/relation';
import { GenerateLineageProofDto } from './dto/generateLineageProofDto';
import { GenerateSpecificLinkProofDto } from './dto/generateSpecificLinkProofDto'; // Added import

@Injectable()
export class ZkSnarkService {
  // private readonly logger = new Logger(ZkSnarkService.name); // Removed logger instance
  constructor(private readonly relationService: RelationService) {}

  async generateProof(payload: {
    // Field names match the Rust ZKP service's ProofRequest struct
    hospital_id: string;      // Semantically: ancestor_id
    treatment: string;        // Semantically: relationship_type
    patient_id: string;       // Semantically: descendant_id
    merkle_leaf_index: number; // Corresponds to u64 in Rust
    merkle_path: string[];      // Array of hex strings
    merkle_root: string;        // Hex string
  }) {
    console.log('[ZkSnarkService] Attempting to generate proof with ZKP service.'); // Changed to console.log
    console.log('[ZkSnarkService] Payload to be sent to ZKP service:', JSON.stringify(payload, null, 2)); // Changed to console.log, kept debug-like detail

    const zkpServiceUrl = process.env.ZKP_SERVICE_URL;
    if (!zkpServiceUrl) {
      console.error('[ZkSnarkService] ZKP_SERVICE_URL is not set. Cannot call ZKP service.'); // Changed to console.error
      throw new Error('ZKP Service URL is not configured.');
    }
    console.log(`[ZkSnarkService] ZKP Service URL: ${zkpServiceUrl}`); // Changed to console.log

    try {
      const res = await fetch(`${zkpServiceUrl}/generate-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseBodyText = await res.text(); // Get response as text first to avoid JSON parse error if not JSON
      console.log(`[ZkSnarkService] ZKP service response status: ${res.status}`); // Changed to console.log
      console.log('[ZkSnarkService] ZKP service response body (text):', responseBodyText); // Changed to console.log, kept debug-like detail

      if (!res.ok) {
        console.error(`[ZkSnarkService] ZKP proof generation error. Status: ${res.status}, Body: ${responseBodyText}`); // Changed to console.error
        throw new Error(`ZKP proof generation error: ${res.status} - ${responseBodyText}`);
      }
      
      return JSON.parse(responseBodyText); // Parse to JSON only if res.ok
    } catch (error) {
      console.error('[ZkSnarkService] Error during fetch to ZKP service:', error.message); // Changed to console.error
      console.error('[ZkSnarkService] Error stack:', error.stack); // Changed to console.error
      if (error.cause) {
        console.error('[ZkSnarkService] Fetch error cause:', error.cause); // Changed to console.error
      }
      throw error; // Re-throw the error to be caught by the controller
    }
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

  async generateLineageProof(dto: GenerateLineageProofDto): Promise<any> {
    const { identifier } = dto;
    // The prepareLineageProofInputs method now takes the general 'identifier'.
    // It will internally resolve it to the correct relation (e.g. family head if identifier is a family.countryId)
    // and use that relation's citizenId and its relationship to its parent family.
    // The previous calls to findRelationWithLineage and checks on targetRelation for this specific purpose are streamlined.
    let proofInputs;
    try {
      proofInputs = await this.relationService.prepareLineageProofInputs(identifier);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Could not prepare proof inputs for identifier '${identifier}': ${error.message}`);
      } else if (error instanceof BadRequestException) { // Catch BadRequest from prepareLineageProofInputs if relation details are missing
        throw new BadRequestException(`Failed to prepare proof inputs for identifier '${identifier}': ${error.message}`);
      }
      // console.error(`[ZkSnarkService.generateLineageProof] Unexpected error from prepareLineageProofInputs for identifier '${identifier}':`, error);
      throw error; // Re-throw other unexpected errors
    }

    // Proceed with the existing proof generation logic using these inputs
    return this.generateProof(proofInputs);
  }

  async generateSpecificLinkProof(dto: GenerateSpecificLinkProofDto): Promise<any> {
    const { ancestorId, relationshipType, descendantId } = dto;

    if (!ancestorId || !relationshipType || !descendantId) {
      throw new BadRequestException(
        'Missing required fields: ancestorId, relationshipType, and descendantId are required.',
      );
    }

    // 1. Call RelationService to get all necessary inputs for ZKP.
    // prepareLineageProofInputs now takes only the descendantId (as a general identifier).
    let proofInputs;
    try {
      proofInputs = await this.relationService.prepareLineageProofInputs(descendantId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(
          `Could not prepare proof inputs for descendant '${descendantId}'. Ensure the descendant exists and is linked to a family. Error: ${error.message}`,
        );
      } else if (error instanceof BadRequestException) {
        throw new BadRequestException(
          `Failed to prepare proof inputs for descendant '${descendantId}'. Error: ${error.message}`
        );
      }
      // console.error(`[ZkSnarkService.generateSpecificLinkProof] Unexpected error from prepareLineageProofInputs for descendantId '${descendantId}':`, error);
      throw error; // Re-throw other unexpected errors
    }

    // 2. Validate that the user-provided ancestorId matches the one derived by the system
    // proofInputs.hospital_id is the system-derived ancestorId (Family.countryId)
    if (ancestorId !== proofInputs.hospital_id) {
      throw new BadRequestException(
        `The provided ancestorId ('${ancestorId}') does not match the actual ancestorId ('${proofInputs.hospital_id}') derived for the descendant ('${descendantId}'). Please verify the input data.`,
      );
    }

    // 3. Validate that the user-provided relationshipType matches the one derived by the system
    // proofInputs.treatment is the system-derived relationship type (Relation.relationship)
    if (relationshipType !== proofInputs.treatment) {
      throw new BadRequestException(
        `The provided relationshipType ('${relationshipType}') does not match the actual relationship ('${proofInputs.treatment}') of the descendant ('${descendantId}') to their parent family. Please verify the input data.`,
      );
    }

    // 4. Call the ZkSnarkService's existing generateProof method with the data prepared by RelationService
    return this.generateProof(proofInputs);
  }
}
