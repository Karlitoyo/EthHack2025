import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerkleService } from '../merkle/merkle.service';
import { Relation } from './relation.entity';
import { Family } from '../family/family.entity';
import { CitizenDataDto } from './dto/relationDataDtos'; // Added import for CitizenDataDto
import { MERKLE_PATH_LEN } from '../merkle/constants/constants'; // Added import for MERKLE_PATH_LEN

// Define a type for the frontend Relation structure for clarity
interface FrontendRelation {
  id: string;
  citizenId: string | null;
  firstName: string;
  lastName: string;
  age: string;
  email: string | null;
  address: string | null;
  contactNumber: string | null;
  relationshipToFamily: string | null;
  merkleRoot: string | null;
}

@Injectable()
export class RelationService {

  constructor(
    @InjectRepository(Relation)
    private readonly relationRepository: Repository<Relation>,
    @InjectRepository(Family)
    private readonly familyRepository: Repository<Family>,
    private readonly merkleService: MerkleService,
  ) {}

  async createRelation(createRelationDto: CitizenDataDto): Promise<Relation> { // Renamed from createPatient, DTO type kept as is
    const { citizenId, relationship, parentCountryId: parentFamilyId } = createRelationDto; // Destructured parentCountryId as parentFamilyId

    const existingRelation = await this.relationRepository.findOne({ // Renamed from existingPatient
      where: { citizenId }, 
    });

    if (existingRelation) {
      throw new ConflictException(`Relation with ID "${citizenId}" already exists.`); // Updated message
    }

    const parentFamily = await this.familyRepository.findOne({ // Renamed from parentCountry
      where: { countryId: parentFamilyId }, // Assuming Family entity uses 'countryId' for its public ID
    });

    if (!parentFamily) {
      throw new NotFoundException(
        `Parent Family with ID "${parentFamilyId}" not found. Relation cannot be created. Please ensure the parent family exists.`, // Updated message
      );
    }

    const relation = this.relationRepository.create({ // Renamed from citizen
      ...createRelationDto,
      family: parentFamily, // Assign the found parent Family entity, assuming 'family' is the field in Relation entity
      merkleRoot: '', // Initialize merkleRoot, assuming it will be updated later
    });

    return this.relationRepository.save(relation);
  }

  async findRelationWithLineage(identifier: string) {
    console.log(`[LINEAGE] Attempting to find relation directly by citizenId: ${identifier}`);
    let relation = await this.relationRepository.findOne({
      where: { citizenId: identifier },
      relations: [
        'family',
        'family.parentFamily',
        'family.parentFamily.parentFamily',
        'family.parentFamily.parentFamily.parentFamily',
      ],
    });

    if (!relation) {
      console.log(`[LINEAGE] No relation found with citizenId: ${identifier}. Attempting to find via family countryId.`);
      const familyByCountryId = await this.familyRepository.findOne({
        where: { countryId: identifier },
        relations: [
          'relation', // Corrected from 'citizens' to 'relation'
          'relation.family', // Eager load family for the relations found
        ],
      });

      if (familyByCountryId) {
        console.log(`[LINEAGE] Found family '${familyByCountryId.name}' (Family ID: ${familyByCountryId.countryId}) using identifier '${identifier}' as countryId.`);
        if (familyByCountryId.relation && familyByCountryId.relation.length > 0) {
          const firstRelationInFamily = familyByCountryId.relation[0];
          console.log(`[LINEAGE] Selected first relation '${firstRelationInFamily.firstName} ${firstRelationInFamily.lastName}\' (Internal DB ID: ${firstRelationInFamily.id}, CitizenID: ${firstRelationInFamily.citizenId}) from this family to display lineage.`);

          // Re-fetch this specific relation with its full lineage relations
          relation = await this.relationRepository.findOne({
            where: { id: firstRelationInFamily.id },
            relations: [
              'family',
              'family.parentFamily',
              'family.parentFamily.parentFamily',
              'family.parentFamily.parentFamily.parentFamily',
            ],
          });

          if (!relation) {
            console.error(`[LINEAGE] Critical error: Could not re-fetch relation with internal DB ID ${firstRelationInFamily.id} after finding it via family ${familyByCountryId.name}.`);
            throw new NotFoundException(`Failed to load details for a member of family with identifier '${identifier}'.`);
          }
          console.log(`[LINEAGE] Successfully loaded relation ${relation.firstName} ${relation.lastName} (CitizenID: ${relation.citizenId}) for lineage display.`);
        } else {
          console.log(`[LINEAGE] Family with countryId '${identifier}' found, but it has no associated relations.`);
          throw new NotFoundException(`Family with identifier '${identifier}' found, but it has no members to display lineage for.`);
        }
      } else {
        console.log(`[LINEAGE] No relation found with citizenId '${identifier}' and no family found with countryId '${identifier}'.`);
        throw new NotFoundException(`No relation or family found matching identifier '${identifier}'.`);
      }
    }

    if (!relation) {
        console.log(`[LINEAGE] Final check: Relation object is unexpectedly null for identifier: ${identifier} after all attempts.`);
        throw new NotFoundException(`Could not determine a relation to display lineage for identifier '${identifier}'.`);
    }

    console.log('[LINEAGE] Processing relation for lineage:', relation.id, relation.citizenId, relation.firstName, relation.lastName);
    console.log("[LINEAGE] Relation's direct parent family data:", JSON.stringify(relation.family, null, 2));

    const targetRelationDetails: FrontendRelation = {
      id: relation.id,
      citizenId: relation.citizenId,
      firstName: relation.firstName,
      lastName: relation.lastName,
      age: relation.age,
      email: relation.email,
      address: relation.address,
      contactNumber: relation.contactNumber,
      relationshipToFamily: relation.relationship,
      merkleRoot: relation.merkleRoot || null,
    };

    const lineagePayload: Array<{
      id: string;
      familyId: string | null;
      name: string;
      location: string;
      roleInFamily: string | undefined | null;
    }> = [];

    const ancestors: Family[] = [];
    let currentFamilyForLineage = relation.family;

    console.log('[LINEAGE] Starting ancestor traversal...');
    while (currentFamilyForLineage) {
      if (ancestors.find(a => a.id === currentFamilyForLineage.id)) {
        console.warn(`[LINEAGE] Cycle detected in family lineage at family ID: ${currentFamilyForLineage.id}. Stopping traversal.`);
        break;
      }
      ancestors.push(currentFamilyForLineage);
      console.log(`[LINEAGE] Added ancestor: ${currentFamilyForLineage.name} (ID: ${currentFamilyForLineage.countryId}, DB_ID: ${currentFamilyForLineage.id}), Role: ${currentFamilyForLineage.relationship}. Total ancestors: ${ancestors.length}`);
      currentFamilyForLineage = currentFamilyForLineage.parentFamily; // Relies on eager loaded parentFamily
    }
    console.log(`[LINEAGE] Ancestor traversal complete. Found ${ancestors.length} ancestors.`);

    for (let i = ancestors.length - 1; i >= 0; i--) {
      const familyMember = ancestors[i];
      lineagePayload.push({
        id: familyMember.id,
        familyId: familyMember.countryId,
        name: familyMember.name,
        location: familyMember.location,
        roleInFamily: familyMember.relationship,
      });
    }
    console.log('[LINEAGE] Lineage payload populated:', JSON.stringify(lineagePayload, null, 2));
    
    let siblingsDetails: FrontendRelation[] = [];

    if (relation.family) {
      const otherRelationsInFamily = await this.relationRepository.find({
        where: { family: { id: relation.family.id } },
      });
      console.log(`[LINEAGE] Found ${otherRelationsInFamily.length} relations in the same family (DB_ID: ${relation.family.id}) as the target.`);

      siblingsDetails = otherRelationsInFamily
        .filter(r => r.id !== relation.id)
        .map(sibling => ({
          id: sibling.id,
          citizenId: sibling.citizenId,
          firstName: sibling.firstName,
          lastName: sibling.lastName,
          age: sibling.age,
          email: sibling.email,
          address: sibling.address,
          contactNumber: sibling.contactNumber,
          relationshipToFamily: sibling.relationship,
          merkleRoot: sibling.merkleRoot || null,
        }));
      console.log(`[LINEAGE] Processed ${siblingsDetails.length} siblings:`, JSON.stringify(siblingsDetails, null, 2));
    } else {
      console.log('[LINEAGE] Target relation has no associated family, cannot find siblings.');
    }

    return {
      targetRelation: targetRelationDetails,
      lineagePath: lineagePayload, // Renamed from lineage to lineagePath for consistency with frontend
      siblings: siblingsDetails,
    };
  }

  async prepareLineageProofInputs(descendantId: string, relationshipType: string) { 
    console.log(
      `[START] prepareLineageProofInputs for descendantId=${descendantId}, relationshipType=${relationshipType}`,
    );

    console.log(
      `[1] Finding descendant relation with ID=${descendantId} and relationship='${relationshipType}' to their direct ancestor family`,
    );
    const relationEntity = await this.relationRepository.findOne({ // Renamed from 'relation' to 'relationEntity' to avoid conflict
      where: { citizenId: descendantId, relationship: relationshipType }, 
      relations: ['family'], 
    });
    if (!relationEntity) { // Use relationEntity
      console.error(
        `[ERROR] Descendant relation not found with ID=${descendantId} and relationship='${relationshipType}' to their direct ancestor family`,
      );
      throw new NotFoundException(`Relation not found with ID=${descendantId} and relationship=${relationshipType}`);
    }
    console.log(`[1] Found descendant relation: ${relationEntity.firstName} ${relationEntity.lastName} (ID: ${relationEntity.citizenId})`);

    const ancestorFamily = relationEntity.family; // Use relationEntity
    if (!ancestorFamily || !ancestorFamily.countryId) { 
      console.error(
        '[ERROR] Descendant relation has invalid ancestor family assignment:',
        ancestorFamily,
      );
      throw new Error('Bad family (ancestor) assignment for relation'); 
    }
    console.log(
      `[1] Ancestor family for the link verified: ${ancestorFamily.name} (ID: ${ancestorFamily.countryId})`, 
    );

    console.log('[2] Collecting all relation-ancestor links for Merkle tree');
    const allRelations = await this.relationRepository.find({ 
      relations: ['family'], 
    });
    console.log(`[2] Found ${allRelations.length} total relation-ancestor links for Merkle tree construction`);

    console.log('[3] Preparing Merkle tree leaf rows');
    const relationRows = allRelations 
      .map(r => toMerklePatientRow(r)) // Pass the iterated relation 'r'
      .filter((row) => row.country_id && row.relation && row.citizen_id); 
    console.log(
      `[3] Generated ${relationRows.length} valid leaf rows for Merkle tree (from ${allRelations.length} potential links)`,
    );

    console.log('[4] Converting specific lineage link (descendant-ancestor) to Merkle leaf format');
    const queryRelationLink = toMerklePatientRow(relationEntity); // Use relationEntity
    console.log(
      '[4] Specific lineage link data for Merkle leaf (PatientRow format):',
      JSON.stringify(queryRelationLink, null, 2),
    );

    console.log('[5] Waiting for MerkleService to be ready'); 
    await this.merkleService.ready; 
    console.log('[5] MerkleService is ready');

    console.log('[5] Generating Merkle proof components (path, root, index)');
    const proofComponents = await this.merkleService.getProof(relationRows, queryRelationLink);
    console.log('[5] Merkle proof components generated successfully');
    console.log('[Root]', proofComponents.merkle_root);
    console.log('[Path]', proofComponents.merkle_path);
    console.log('[Leaf Index]', proofComponents.merkle_leaf_index);
    
    if (proofComponents.merkle_path.length !== MERKLE_PATH_LEN) {
      console.error(
        `[ERROR] Invalid Merkle path length: ${proofComponents.merkle_path.length}, expected: ${MERKLE_PATH_LEN}`
      );
      throw new Error('BUG: Merkle service returned a bad path length!');
    }
    console.log('[5] Merkle path length verified');

    return {
      hospital_id: queryRelationLink.country_id, 
      treatment: queryRelationLink.relation,     
      patient_id: queryRelationLink.citizen_id,  
      merkle_leaf_index: proofComponents.merkle_leaf_index,
      merkle_path: proofComponents.merkle_path,
      merkle_root: proofComponents.merkle_root,
    };
  }
}

// Utility function to map Relation entity to PatientRow structure for Merkle tree
// This needs to be defined or imported. Assuming it exists and is correctly implemented.
// For example:
function toMerklePatientRow(relation: Relation): { country_id: string | null; relation: string | null; citizen_id: string | null } {
  if (!relation) {
    return { country_id: null, relation: null, citizen_id: null };
  }
  return {
    country_id: relation.family?.countryId || null,
    relation: relation.relationship || null,
    citizen_id: relation.citizenId || null,
  };
}
