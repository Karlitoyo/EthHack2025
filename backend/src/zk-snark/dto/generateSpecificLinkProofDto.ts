import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateSpecificLinkProofDto {
  @IsString()
  @IsNotEmpty()
  ancestorId: string; // User-facing ID of the parent/ancestor Family (Family.countryId)

  @IsString()
  @IsNotEmpty()
  relationshipType: string; // The relationship of the descendant to the ancestor's family (e.g., "Son")

  @IsString()
  @IsNotEmpty()
  descendantId: string; // User-facing ID of the child/descendant Relation (Relation.citizenId)
}
