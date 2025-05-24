import { Relation } from './relation.entity';
import { Repository } from 'typeorm';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'; // Import NotFoundException and ConflictException
import { InjectRepository } from '@nestjs/typeorm';
import { CitizenDataDto } from './dto/relationDataDtos';
import { Family } from '../family/family.entity';
import { ILike } from 'typeorm';
import { MerkleService } from '../merkle/merkle.service'; // adjust the import!
// import { toMerklePatientRow } from '../merkle/utils';
import { MERKLE_PATH_LEN } from '../merkle/constants/constants';

@Injectable()
export class RelationService { // Renamed from CitizenService

  constructor(
    @InjectRepository(Relation)
    private readonly relationRepository: Repository<Relation>, // Renamed from citizenRepository
    @InjectRepository(Family)
    private readonly familyRepository: Repository<Family>, // Renamed from countryRepository
    private readonly merkleService: MerkleService, // Renamed from merkleManager for consistency
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
    });

    return this.relationRepository.save(relation);
  }

  async findRelationWithLineage(relationIdentifier: string) { // Renamed from findCitizenInCountrysByRelationship
    console.log(`[LINEAGE] Searching for relation with identifier: ${relationIdentifier}`);
    const relation = await this.relationRepository.findOne({ // Renamed from citizen
      where: [
        { citizenId: relationIdentifier }, 
      ],
      relations: [
        'family',
        'family.parentFamily', // Corrected: Was family.parentCountry
        'family.parentFamily.parentFamily', // Corrected: Was family.parentCountry.parentCountry
      ],
    });

    if (!relation) {
      console.log(`[LINEAGE] Relation not found: ${relationIdentifier}`);
      throw new NotFoundException(`Relation with identifier '${relationIdentifier}' not found.`);
    }
    console.log('[LINEAGE] Found relation:', relation.id, relation.citizenId, relation.firstName, relation.lastName);
    console.log("[LINEAGE] Relation's direct parent family data:", JSON.stringify(relation.family, null, 2));

    const targetRelationDetails = { // Renamed from targetCitizenDetails
      id: relation.id,
      citizenId: relation.citizenId,
      firstName: relation.firstName,
      lastName: relation.lastName,
      age: relation.age,
      email: relation.email,
      address: relation.address,
      phone: relation.contactNumber,
      relationshipToFamily: relation.relationship, // Renamed from relationshipToParentCountry
    };

    const lineage: Array<{
      id: string;
      familyId: string | null; 
      name: string;
      location: string;
      roleInFamily: string | undefined; 
    }> = [];

    const ancestors = [];
    let tempFamily = relation.family; 
    console.log('[LINEAGE] Initial ancestor family for traversal:', JSON.stringify(tempFamily, null, 2));

    while (tempFamily) {
      ancestors.push(tempFamily);
      console.log(`[LINEAGE] Added ancestor family to chain: ${tempFamily.countryId} - ${tempFamily.name}. Total ancestors in chain: ${ancestors.length}`);
      // Corrected: Use parentFamily
      if (tempFamily.parentFamily && !ancestors.find(a => a.id === tempFamily.parentFamily?.id)) { 
        tempFamily = tempFamily.parentFamily; 
        console.log('[LINEAGE] Moved to next ancestor family (parentFamily, already loaded):', JSON.stringify(tempFamily, null, 2));
      } else if (tempFamily.parentFamily && ancestors.find(a => a.id === tempFamily.parentFamily?.id)) {
        console.log('[LINEAGE] Circular dependency or already processed ancestor family. Breaking traversal.');
        break; 
      }
      else {
        console.log('[LINEAGE] Next ancestor family (parentFamily) not directly available as an object or end of chain. Current ancestor family:', JSON.stringify(tempFamily, null, 2));
        // Attempt to access deeply loaded parent if available, otherwise set to null
        // Corrected: Use parentFamily
        if (relation.family?.parentFamily?.id === tempFamily.parentFamily?.id) {
            tempFamily = relation.family.parentFamily; 
        } else if (relation.family?.parentFamily?.parentFamily?.id === tempFamily.parentFamily?.id) { // Check one level deeper
            tempFamily = relation.family.parentFamily.parentFamily; 
        } else {
            tempFamily = null; 
        }
        console.log('[LINEAGE] Next ancestor family after checking deep relations:', JSON.stringify(tempFamily, null, 2));

        if (tempFamily && typeof tempFamily.id === 'undefined') {
            console.log('[LINEAGE] Current ancestor family became invalid (no id). Setting to null for traversal stop.');
            tempFamily = null;
        }
      }
    }
    console.log(`[LINEAGE] Ancestor family traversal complete. Found ${ancestors.length} ancestors in the chain.`);

    for (let i = ancestors.length - 1; i >= 0; i--) {
      const ancestor = ancestors[i];
      lineage.push({
        id: ancestor.id,
        familyId: ancestor.countryId, 
        name: ancestor.name,
        location: ancestor.location,
        roleInFamily: ancestor.relationship, 
      });
    }
    
    let siblingsDetails: Array<{
      id: string;
      citizenId: string | null; 
      firstName: string;
      lastName: string;
      age: string;
      relationshipToFamily: string | undefined; 
    }> = [];

    if (relation.family) {
      const directParentFamilyWithAllMembers = await this.familyRepository.findOne({ 
        where: { id: relation.family.id },
        relations: ['relation'], // Corrected: Family.relation (singular) for child Relations
      });

      // Corrected: Check Family.relation (singular)
      if (directParentFamilyWithAllMembers && directParentFamilyWithAllMembers.relation) { 
        siblingsDetails = directParentFamilyWithAllMembers.relation 
          .filter(r => r.id !== relation.id) 
          .map(s => ({
            id: s.id,
            citizenId: s.citizenId, 
            firstName: s.firstName,
            lastName: s.lastName,
            age: s.age,
            relationshipToFamily: s.relationship, 
          }));
      }
    }

    return {
      targetRelation: targetRelationDetails, 
      lineage: lineage, 
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
    country_id: relation.family?.countryId || null, // Assumes family's public ID is countryId
    relation: relation.relationship || null,
    citizen_id: relation.citizenId || null,
  };
}
