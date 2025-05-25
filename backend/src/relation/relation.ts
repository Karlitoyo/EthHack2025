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
    members: FrontendRelation[]; // Added members
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
    const { citizenId, relationship, parentFamilyId: parentFamilyId, isFamilyHead } = createRelationDto;

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
      isFamilyHead: isFamilyHead || false, // Set isFamilyHead
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
            if (foundRelation) { // Added check and return
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

        // Updated logic to find the family head or fallback
        if (familySearchedById.relation && familySearchedById.relation.length > 0) {
          relationToUse = familySearchedById.relation.find(r => r.isFamilyHead) || familySearchedById.relation[0];
          if (familySearchedById.relation.find(r => r.isFamilyHead)) {
            console.log(`[LINEAGE] Using family head relation '${relationToUse.firstName} ${relationToUse.lastName}' (DB ID: ${relationToUse.id}) of family '${familySearchedById.name}' as target.`);
          } else {
            console.log(`[LINEAGE] No family head found. Using first available relation '${relationToUse.firstName} ${relationToUse.lastName}' (DB ID: ${relationToUse.id}) of family '${familySearchedById.name}' as target.`);
          }
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
      // isFamilyHead: targetRelationEntity.isFamilyHead, // Add if you want to pass this to frontend
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

    // Ensure members are loaded for the targetRelation's family, as it might not be part of ancestors if it's the root
    if (targetRelationEntity.family && !ancestors.find(a => a.id === targetRelationEntity.family.id)) {
      const relationsInTargetFamily = await this.relationRepository.find({
        where: { family: { id: targetRelationEntity.family.id } },
      });
      // Add members to the family object if it's directly on targetRelationEntity and not yet processed
      // This scenario is less likely if lineagePath always includes the immediate family, but good for robustness.
    }


    for (let i = ancestors.length - 1; i >= 0; i--) {
      const familyMember = ancestors[i]; // This is a Family entity

      // Fetch members of this familyMember (Family entity)
      const relationsInFamily = await this.relationRepository.find({
        where: { family: { id: familyMember.id } },
      });
      const members: FrontendRelation[] = relationsInFamily.map(r => ({
        id: r.id,
        citizenId: r.citizenId,
        firstName: r.firstName,
        lastName: r.lastName,
        age: r.age,
        email: r.email,
        address: r.address,
        contactNumber: r.contactNumber,
        relationshipToFamily: r.relationship, // This is Relation.relationship (e.g., "Son", "Head")
        merkleRoot: r.merkleRoot || null,
      }));

      lineagePayload.push({
        id: familyMember.id,
        familyId: familyMember.countryId,
        name: familyMember.name,
        location: familyMember.location,
        roleInFamily: familyMember.relationship, // This is Family.relationship (e.g., "Main Branch", "Cadet Branch")
        members: members, // Add the populated members
      });
    }
    console.log('[LINEAGE] Lineage payload populated (structure might be too large for full log):', lineagePayload.map(p => ({...p, members: p.members.length + ' members'})));
    
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

  async prepareLineageProofInputs(identifier: string /*, relationshipType?: string */) { // relationshipType might be deprecated or derived
    console.log(
      `[START] prepareLineageProofInputs for identifier=${identifier}`
    );

    let relationEntity: Relation | null = null;
    let identifiedFamily: Family | null = null;

    // Try to find by citizenId first
    relationEntity = await this.relationRepository.findOne({ 
      where: { citizenId: identifier }, 
      relations: ['family'], 
    });

    if (relationEntity) {
      console.log(`[1] Found relation directly by citizenId: ${relationEntity.firstName} ${relationEntity.lastName} (ID: ${relationEntity.citizenId})`);
      if (!relationEntity.family) {
        console.error(`[ERROR] Relation ${relationEntity.citizenId} does not have a linked family.`);
        throw new NotFoundException(`Relation ${relationEntity.citizenId} is not linked to any family.`);
      }
      identifiedFamily = relationEntity.family;
    } else {
      // If not found by citizenId, try to find by family.countryId and then get the head
      console.log(`[1] Relation not found by citizenId '${identifier}'. Trying to find Family by countryId '${identifier}'.`);
      identifiedFamily = await this.familyRepository.findOne({
        where: { countryId: identifier },
        relations: ['relation'], // Need relations to find the head
      });

      if (identifiedFamily) {
        console.log(`[1] Found family: ${identifiedFamily.name} (ID: ${identifiedFamily.countryId})`);
        if (identifiedFamily.relation && identifiedFamily.relation.length > 0) {
          const chosenRelationBrief = identifiedFamily.relation.find(r => r.isFamilyHead) || identifiedFamily.relation[0]; // Prioritize head, fallback to first
          
          if (!chosenRelationBrief) {
             console.error(`[ERROR] Family ${identifiedFamily.countryId} has relations but failed to select one (e.g., array contained only nulls).`);
             throw new NotFoundException(`Could not select a representative relation for family ${identifiedFamily.countryId}.`);
          }
          console.log(`[1] Tentatively selected relation: ${chosenRelationBrief.firstName} ${chosenRelationBrief.lastName} (DB ID: ${chosenRelationBrief.id}, CitizenID: ${chosenRelationBrief.citizenId}, Head: ${chosenRelationBrief.isFamilyHead}) from family ${identifiedFamily.name}. Reloading with family details...`);

          // Reload the chosen relation to ensure its 'family' relation is loaded
          relationEntity = await this.relationRepository.findOne({
            where: { id: chosenRelationBrief.id },
            relations: ['family'],
          });

          if (!relationEntity) {
            console.error(`[ERROR] Failed to reload relation with DB ID ${chosenRelationBrief.id}. This should not happen if it was found in identifiedFamily.relation.`);
            throw new NotFoundException(`Could not load details for the selected representative relation (DB ID: ${chosenRelationBrief.id}) from family ${identifiedFamily.countryId}.`);
          }

          // Verification step: Ensure the reloaded relation is indeed part of the identified family
          if (!relationEntity.family || relationEntity.family.id !== identifiedFamily.id) {
              console.error(`[CRITICAL ERROR] Mismatch or missing family after reloading relation ${relationEntity.id}. Expected family ID ${identifiedFamily.id} (countryId: ${identifiedFamily.countryId}), but reloaded relation's family is ID ${relationEntity.family?.id} (countryId: ${relationEntity.family?.countryId}).`);
              throw new Error('Internal error: Family context mismatch after reloading relation. The reloaded relation is not correctly associated with the identified family.');
          }
          
          console.log(`[1] Successfully selected and reloaded relation for proof: ${relationEntity.firstName} ${relationEntity.lastName} (CitizenID: ${relationEntity.citizenId}, Head: ${relationEntity.isFamilyHead}) from family ${relationEntity.family.name} (Family CountryID: ${relationEntity.family.countryId})`);
        } else {
          console.error(`[ERROR] Family ${identifiedFamily.countryId} has no relations.`);
          throw new NotFoundException(`Family ${identifiedFamily.countryId} found, but it has no associated relations to generate a proof for.`);
        }
      } else {
        console.error(`[ERROR] No relation found with citizenId='${identifier}' and no family found with countryId='${identifier}'.`);
        throw new NotFoundException(`No relation or family found matching identifier '${identifier}'.`);
      }
    }

    if (!relationEntity || !relationEntity.family || !relationEntity.family.countryId || !relationEntity.relationship || !relationEntity.citizenId) {
      console.error(
        '[ERROR] Critical: Could not establish a valid relation entity with required fields (citizenId, family, family.countryId, relationship) for proof generation.',
        { 
          relationId: relationEntity?.id,
          citizenId: relationEntity?.citizenId,
          familyDBId: relationEntity?.family?.id, // Log family's DB ID
          familyCountryId: relationEntity?.family?.countryId, 
          relationship: relationEntity?.relationship 
        }
      );
      throw new Error('Failed to prepare a valid relation for proof. Missing essential link details.');
    }
    
    const ancestorFamilyId = relationEntity.family.countryId;
    const actualRelationshipType = relationEntity.relationship; // This is the 'treatment' or link type
    const descendantCitizenId = relationEntity.citizenId;

    console.log(
      `[1] Proof target: Descendant '${descendantCitizenId}' (${actualRelationshipType}) -> Ancestor Family '${ancestorFamilyId}'`
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
        // Add more detailed logging here if this error occurs
        console.error('Failed to convert target relation to Merkle leaf. Details:', {
            relationEntityId: relationEntity.id,
            familyCountryId: relationEntity.family?.countryId,
            relationship: relationEntity.relationship,
            citizenId: relationEntity.citizenId,
            convertedCountryId: queryRelationLink.country_id,
            convertedRelation: queryRelationLink.relation,
            convertedCitizenId: queryRelationLink.citizen_id,
        });
        throw new Error('Failed to convert the target relation to a valid Merkle leaf row. Essential fields were missing or null after conversion.');
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
