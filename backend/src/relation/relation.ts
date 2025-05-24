import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerkleService } from '../merkle/merkle.service';
import { Relation } from './relation.entity';
import { Family } from '../family/family.entity';
import { CitizenDataDto } from './dto/relationDataDtos';
import { MERKLE_PATH_LEN } from '../merkle/constants/constants';
import { toMerklePatientRow } from '../merkle/utils'; // Import the utility function for converting Relation to PatientRow

// Define and export a type for the frontend Relation structure for clarity
export interface FrontendRelation {
  id: string;
  citizenId: string | null;
  firstName: string;
  lastName: string;
  age: string;
  email: string | null;
  address: string | null;
  contactNumber: string | null;
  relationshipToFamily: string | null; // Changed from 'relationship'
  merkleRoot: string | null; // Changed from 'merkleRoot' to match the backend structure
}

// Define and export a type for the lineage path items
export interface LineagePathItem {
    id: string;
    familyId: string | null;
    name: string;
    location: string;
    roleInFamily: string | undefined | null;
}

// Define and export the overall response structure for findRelationWithLineage
export interface LineageResponse {
    targetRelation: FrontendRelation;
    lineagePath: LineagePathItem[];
    siblings: FrontendRelation[];
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

  async createRelation(createRelationDto: CitizenDataDto): Promise<Relation> {
    const { citizenId, relationship, parentCountryId: parentFamilyId } = createRelationDto;

    const existingRelation = await this.relationRepository.findOne({
      where: { citizenId }, 
    });

    if (existingRelation) {
      throw new ConflictException(`Relation with ID \"${citizenId}\" already exists.`);
    }

    const parentFamily = await this.familyRepository.findOne({
      where: { countryId: parentFamilyId },
    });

    if (!parentFamily) {
      throw new NotFoundException(
        `Parent Family with ID \"${parentFamilyId}\" not found. Relation cannot be created. Please ensure the parent family exists.`,
      );
    }

    const relation = this.relationRepository.create({
      ...createRelationDto,
      family: parentFamily,
      merkleRoot: '', // Initialize merkleRoot, e.g., to an empty string or null
    });

    return this.relationRepository.save(relation);
  }

  private async findFirstDescendantRelation(familyEntity: Family): Promise<Relation | null> {
    // Load the family with its direct relations and child families to ensure we have the necessary data
    const family = await this.familyRepository.findOne({
        where: { id: familyEntity.id },
        relations: [
            'relation', // Direct relations of this family
            'childFamilies', // Its direct children
            'childFamilies.relation', // Eagerly load relations of child families
            'childFamilies.childFamilies' // For deeper recursion if necessary, though direct check is below
        ],
    });

    if (!family) {
        console.warn(`[DESCENDANT_SEARCH] Family with ID ${familyEntity.id} not found during recursive search.`);
        return null;
    }

    // 1. Check if this family itself has relations
    if (family.relation && family.relation.length > 0) {
        console.log(`[DESCENDANT_SEARCH] Found direct relation in family ${family.name} (ID: ${family.countryId}).`);
        return family.relation[0]; // Return the first direct relation
    }

    // 2. If not, iterate through its child families and recurse
    if (family.childFamilies && family.childFamilies.length > 0) {
        console.log(`[DESCENDANT_SEARCH] Family ${family.name} (ID: ${family.countryId}) has no direct relations. Checking ${family.childFamilies.length} child families.`);
        for (const childFamily of family.childFamilies) {
            // The childFamily object here is from the parent's list.
            // The recursive call will reload it by its ID to get its own relations/children.
            const foundRelation = await this.findFirstDescendantRelation(childFamily);
            if (foundRelation) {
                console.log(`[DESCENDANT_SEARCH] Found descendant relation via child family ${childFamily.name} (ID: ${childFamily.countryId}).`);
                return foundRelation; // Found a relation in a descendant branch
            }
        }
    }
    console.log(`[DESCENDANT_SEARCH] No relations found in family ${family.name} (ID: ${family.countryId}) or its direct descendants.`);
    return null; // No relation found in this family or its descendants
  }

  async findRelationWithLineage(identifier: string): Promise<LineageResponse> {
    console.log(`[LINEAGE] Attempting to find relation directly by citizenId: ${identifier}`);
    let targetRelationEntity: Relation | null = await this.relationRepository.findOne({
      where: { citizenId: identifier },
      relations: [
        'family',
        'family.parentFamily',
        'family.parentFamily.parentFamily',
        'family.parentFamily.parentFamily.parentFamily',
      ],
    });

    if (!targetRelationEntity) {
      console.log(`[LINEAGE] No relation found with citizenId: ${identifier}. Attempting to find via family countryId.`);
      const familySearchedById = await this.familyRepository.findOne({
        where: { countryId: identifier }, 
        relations: ['relation', 'childFamilies'],
      });

      if (familySearchedById) {
        console.log(`[LINEAGE] Found family '${familySearchedById.name}' (Family ID: ${familySearchedById.countryId}) using identifier '${identifier}' as countryId.`);
        
        let relationToUse: Relation | null = null;

        if (familySearchedById.relation && familySearchedById.relation.length > 0) {
          relationToUse = familySearchedById.relation[0];
          console.log(`[LINEAGE] Using direct relation '${relationToUse.firstName} ${relationToUse.lastName}' (DB ID: ${relationToUse.id}) of family '${familySearchedById.name}' as target.`);
        } else {
          console.log(`[LINEAGE] Family '${familySearchedById.name}' has no direct relations. Searching for a descendant relation.`);
          relationToUse = await this.findFirstDescendantRelation(familySearchedById);
          if (relationToUse) {
            console.log(`[LINEAGE] Using descendant relation '${relationToUse.firstName} ${relationToUse.lastName}' (DB ID: ${relationToUse.id}) as target.`);
          } else {
            console.log(`[LINEAGE] Family with countryId '${identifier}' found, but it has no direct members and no findable descendant relations.`);
            throw new NotFoundException(`Family with identifier '${identifier}' found, but no related individuals (direct or descendant) could be found to display lineage for.`);
          }
        }

        if (relationToUse) {
            // We need to reload the relationToUse with all its ancestral families for the lineage path
            targetRelationEntity = await this.relationRepository.findOne({
                where: { id: relationToUse.id },
                relations: ['family', 'family.parentFamily', 'family.parentFamily.parentFamily', 'family.parentFamily.parentFamily.parentFamily'],
            });
            if (!targetRelationEntity) {
                 console.error(`[LINEAGE] Critical error: Could not re-fetch relation with internal DB ID ${relationToUse.id} after identifying it.`);
                 throw new NotFoundException(`Failed to load details for the identified individual.`);
            }
        } else { // Should be caught by earlier throw, but as a safeguard
            console.error(`[LINEAGE] Critical error: Failed to establish a target relation for family ID '${identifier}' after checking direct and descendant paths.`);
            throw new NotFoundException(`Could not determine an individual to display lineage for, based on family identifier '${identifier}'.`);
        }

      } else {
        console.log(`[LINEAGE] No relation found with citizenId '${identifier}' and no family found with countryId '${identifier}'.`);
        throw new NotFoundException(`No relation or family found matching identifier '${identifier}'.`);
      }
    }

    if (!targetRelationEntity) {
        console.log(`[LINEAGE] Final check: targetRelationEntity is unexpectedly null for identifier: ${identifier} after all attempts.`);
        throw new NotFoundException(`Could not determine a relation to display lineage for identifier '${identifier}'.`);
    }

    console.log('[LINEAGE] Processing relation for lineage:', targetRelationEntity.id, targetRelationEntity.citizenId, targetRelationEntity.firstName, targetRelationEntity.lastName);
    console.log("[LINEAGE] Relation's direct parent family data:", JSON.stringify(targetRelationEntity.family, null, 2));

    const targetRelationDetails: FrontendRelation = {
      id: targetRelationEntity.id,
      citizenId: targetRelationEntity.citizenId,
      firstName: targetRelationEntity.firstName,
      lastName: targetRelationEntity.lastName,
      age: targetRelationEntity.age,
      email: targetRelationEntity.email,
      address: targetRelationEntity.address,
      contactNumber: targetRelationEntity.contactNumber,
      relationshipToFamily: targetRelationEntity.relationship,
      merkleRoot: targetRelationEntity.merkleRoot || null,
    };

    const lineagePayload: LineagePathItem[] = [];
    const ancestors: Family[] = [];
    let currentFamilyForLineage = targetRelationEntity.family;

    console.log('[LINEAGE] Starting ancestor traversal...');
    while (currentFamilyForLineage) {
      if (ancestors.find(a => a.id === currentFamilyForLineage.id)) {
        console.warn(`[LINEAGE] Cycle detected in family lineage at family ID: ${currentFamilyForLineage.id}. Stopping traversal.`);
        break;
      }
      ancestors.push(currentFamilyForLineage);
      console.log(`[LINEAGE] Added ancestor: ${currentFamilyForLineage.name} (ID: ${currentFamilyForLineage.countryId}, DB_ID: ${currentFamilyForLineage.id}), Role: ${currentFamilyForLineage.relationship}. Total ancestors: ${ancestors.length}`);
      currentFamilyForLineage = currentFamilyForLineage.parentFamily; 
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
    if (targetRelationEntity.family) {
      const otherRelationsInFamily = await this.relationRepository.find({
        where: { family: { id: targetRelationEntity.family.id } }, 
      });
      console.log(`[LINEAGE] Found ${otherRelationsInFamily.length} relations in the same family (DB_ID: ${targetRelationEntity.family.id}) as the target.`);

      siblingsDetails = otherRelationsInFamily
        .filter(r => r.id !== targetRelationEntity!.id) // Added non-null assertion for targetRelationEntity
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
      lineagePath: lineagePayload, 
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
    const relationEntity = await this.relationRepository.findOne({ 
      where: { citizenId: descendantId, relationship: relationshipType }, 
      relations: ['family'], 
    });
    if (!relationEntity) { 
      console.error(
        `[ERROR] Descendant relation not found with ID=${descendantId} and relationship='${relationshipType}' to their direct ancestor family`,
      );
      throw new NotFoundException(`Relation not found with ID=${descendantId} and relationship=${relationshipType}`);
    }
    console.log(`[1] Found descendant relation: ${relationEntity.firstName} ${relationEntity.lastName} (ID: ${relationEntity.citizenId})`);

    const ancestorFamily = relationEntity.family; 
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
      .map(r => toMerklePatientRow(r)) 
      .filter((row): row is PatientRow & { country_id: string; relation: string; citizen_id: string } => !!row.country_id && !!row.relation && !!row.citizen_id);
    console.log(
      `[3] Generated ${relationRows.length} valid leaf rows for Merkle tree (from ${allRelations.length} potential links)`,
    );

    console.log('[4] Converting specific lineage link (descendant-ancestor) to Merkle leaf format');
    const queryRelationLink = toMerklePatientRow(relationEntity); 
    if (!queryRelationLink.country_id || !queryRelationLink.relation || !queryRelationLink.citizen_id) {
        throw new Error('Failed to convert the target relation to a valid Merkle leaf row.');
    }
    console.log(
      '[4] Specific lineage link data for Merkle leaf (PatientRow format):',
      JSON.stringify(queryRelationLink, null, 2),
    );

    console.log('[5] Waiting for MerkleService to be ready'); 
    await this.merkleService.ready; 
    console.log('[5] MerkleService is ready');

    console.log('[5] Generating Merkle proof components (path, root, index)');
    const proofComponents = await this.merkleService.getProof(relationRows, queryRelationLink as any); // Cast to any if types are conflicting due to nullability
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
// Consider moving this to a shared utility location, e.g., backend/src/merkle/utils.ts
interface PatientRow {
    country_id: string | null; // Changed from countryId
    relation: string | null;   // Changed from relationship
    citizen_id: string | null; // Changed from citizenId
}
