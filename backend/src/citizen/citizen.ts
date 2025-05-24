import { Citizen } from './citizen.entity';
import { Repository } from 'typeorm';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'; // Import NotFoundException and ConflictException
import { InjectRepository } from '@nestjs/typeorm';
import { CitizenDataDto } from './dto/citizenDataDtos';
import { Country } from '../country/country.entity';
import { ILike } from 'typeorm';
import { MerkleService } from '../merkle/merkle.service'; // adjust the import!
import { toMerklePatientRow } from '../merkle/utils';
import { MERKLE_PATH_LEN } from '../merkle/constants/constants';

@Injectable()
export class CitizenService {

  constructor(
    @InjectRepository(Citizen)
    private readonly citizenRepository: Repository<Citizen>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    private readonly merkleManager: MerkleService,
  ) {}

  async createPatient(createCitizenDto: CitizenDataDto): Promise<Citizen> {
    const { citizenId, relationship, parentCountryId } = createCitizenDto; // Added parentCountryId

    // Check if a patient with the same ID already exists
    const existingPatient = await this.citizenRepository.findOne({
      where: { citizenId },
    });

    if (existingPatient) {
      // Throw ConflictException (HTTP 409)
      throw new ConflictException(`Patient with ID "${citizenId}" already exists.`);
    }

    // Find the parent Country entity using the provided parentCountryId
    const parentCountry = await this.countryRepository.findOne({
      where: { countryId: parentCountryId }, // Changed from 'id' to 'countryId'
    });

    // Check if the parent Country was found
    if (!parentCountry) {
      // Throw NotFoundException (HTTP 404)
      throw new NotFoundException(
        `Parent Country with ID "${parentCountryId}" not found. Patient cannot be created. Please ensure the parent country exists.`,
      );
    }

    // Create the citizen and assign the found parent Country
    const citizen = this.citizenRepository.create({
      ...createCitizenDto,
      country: parentCountry, // Assign the found parent Country entity
    });

    return this.citizenRepository.save(citizen);
  }

  // citizen.service.ts
  async findHospitalsAndPatientsByTreatment(relationship: string) {
    const countries = await this.countryRepository.find({
      where: { relationship },
    });

    const citizens = await this.citizenRepository.find({
      where: { relationship },
    });

    // Group patients by hospitalId
    const result = countries.map((country) => {
      const matchingCitizen = citizens.filter(
        (citizen) => citizen.relationship === relationship, // Additional filters can go here
      );

      return {
        id: country.id,
        name: country.name,
        location: country.location,
        citizen: matchingCitizen,
      };
    });

    return {
      relationship,
      hospitals: result,
    };
  }

  async findCitizenInCountrysByRelationship(citizenIdentifier: string) {
    console.log(`[LINEAGE] Searching for citizen with identifier: ${citizenIdentifier}`);
    const citizen = await this.citizenRepository.findOne({
      where: [
        { citizenId: citizenIdentifier },
      ],
      relations: [
        'country', 
        'country.parentCountry',
        'country.parentCountry.parentCountry',
      ],
    });

    if (!citizen) {
      console.log(`[LINEAGE] Citizen not found: ${citizenIdentifier}`);
      throw new NotFoundException(`Citizen with identifier '${citizenIdentifier}' not found.`);
    }
    console.log('[LINEAGE] Found citizen:', citizen.id, citizen.citizenId);
    console.log('[LINEAGE] Citizen Country data:', JSON.stringify(citizen.country, null, 2));

    const targetCitizenDetails = {
      id: citizen.id,
      citizenId: citizen.citizenId,
      firstName: citizen.firstName,
      lastName: citizen.lastName,
      age: citizen.age,
      email: citizen.email,
      address: citizen.address,
      phone: citizen.contactNumber,
      // This is the citizen's relationship to their direct parent country (e.g., "son")
      relationshipToParentCountry: citizen.relationship, 
    };

    const lineage: Array<{
      id: string;
      countryId: string | null;
      name: string;
      location: string;
      roleInFamily: string | undefined; // e.g., "father", "grandfather" from Country.relationship
    }> = [];

    let currentAncestorCountry = citizen.country;
    
    // Traverse up the ancestry chain (Country -> parentCountry -> parentCountry ...)
    const ancestors = [];
    let tempCountry = citizen.country;
    console.log('[LINEAGE] Initial tempCountry for ancestor traversal:', JSON.stringify(tempCountry, null, 2));

    while (tempCountry) {
      ancestors.push(tempCountry);
      console.log(`[LINEAGE] Added ancestor: ${tempCountry.id} - ${tempCountry.name}. Total ancestors: ${ancestors.length}`);
      // Ensure the parentCountry relation was loaded or fetch it if necessary.
      // The deep relations in the initial query should handle this up to the specified depth.
      if (tempCountry.parentCountry && !ancestors.find(a => a.id === tempCountry.parentCountry!.id)) {
        tempCountry = tempCountry.parentCountry;
        console.log('[LINEAGE] Moved to parentCountry (already loaded):', JSON.stringify(tempCountry, null, 2));
      } else if (tempCountry.parentCountry && ancestors.find(a => a.id === tempCountry.parentCountry!.id)) {
        console.log('[LINEAGE] Circular dependency or already processed parent. Breaking.');
        break; 
      }
      else {
        // This block might indicate that parentCountry was not loaded as an object
        console.log('[LINEAGE] parentCountry not directly available as an object or end of chain. Current tempCountry:', JSON.stringify(tempCountry, null, 2));
        // Attempt to access deeply loaded parent if available, otherwise set to null
        // This logic might be too simplistic if arbitrary depth is needed beyond initial relations
        if (citizen.country?.parentCountry?.id === tempCountry.parentCountry?.id) {
            tempCountry = citizen.country.parentCountry;
        } else if (citizen.country?.parentCountry?.parentCountry?.id === tempCountry.parentCountry?.id) {
            tempCountry = citizen.country.parentCountry.parentCountry;
        } else {
            tempCountry = null; // End of loaded chain or actual top
        }
        console.log('[LINEAGE] Next tempCountry after checking deep relations:', JSON.stringify(tempCountry, null, 2));

        if (tempCountry && typeof tempCountry.id === 'undefined') {
            console.log('[LINEAGE] tempCountry became invalid (no id). Setting to null.');
            tempCountry = null;
        }
      }
    }
    console.log(`[LINEAGE] Ancestor traversal complete. Found ${ancestors.length} ancestors.`);

    // Add ancestors to lineage, oldest first
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const ancestor = ancestors[i];
      lineage.push({
        id: ancestor.id,
        countryId: ancestor.countryId,
        name: ancestor.name,
        location: ancestor.location,
        roleInFamily: ancestor.relationship, // This is the Country's own defined role
      });
    }
    
    let siblingsDetails: Array<{
      id: string;
      citizenId: string | null;
      firstName: string;
      lastName: string;
      age: string;
      relationshipToParentCountry: string | undefined; // e.g., "son", "daughter"
    }> = [];

    if (citizen.country) {
      // Reload the direct parent country to ensure all its citizens (children/siblings) are loaded
      const directParentCountryWithAllChildren = await this.countryRepository.findOne({
        where: { id: citizen.country.id },
        relations: ['citizen'], // Load all citizens of this country
      });

      if (directParentCountryWithAllChildren && directParentCountryWithAllChildren.citizen) {
        siblingsDetails = directParentCountryWithAllChildren.citizen
          .filter(c => c.id !== citizen.id) // Exclude the target citizen itself
          .map(s => ({
            id: s.id,
            citizenId: s.citizenId,
            firstName: s.firstName,
            lastName: s.lastName,
            age: s.age,
            relationshipToParentCountry: s.relationship, // Citizen's relationship to the common parent Country
          }));
      }
    }

    return {
      targetCitizen: targetCitizenDetails,
      lineage: lineage, // Ordered from oldest ancestor to direct parent country
      siblings: siblingsDetails,
    };
  }

  async generateTreatmentProof(citizenId: string, relationship: string) {
    console.log(
      `[START] generateTreatmentProof for patientId=${citizenId}, treatment=${relationship}`,
    );

    // 1. Find the patient to prove
    console.log(
      `[1] Finding patient with ID=${citizenId} and treatment=${relationship}`,
    );
    const citizen = await this.citizenRepository.findOne({
      where: { citizenId, relationship },
      relations: ['country'], // Ensure the hospital relation is loaded
      // relations: ['hospital'], // If using 'hospital' relation instead of 'country'
    });
    if (!citizen) {
      console.error(
        `[ERROR] Patient not found with ID=${citizenId} and treatment=${relationship}`,
      );
      throw new Error('Patient not found');
    }
    console.log(`[1] Found patient: ${citizen.firstName} ${citizen.lastName}`);

    const country = citizen.country;
    if (!country || !country.countryId) {
      console.error(
        '[ERROR] Patient has invalid country assignment:',
        country,
      );
      throw new Error('Bad country assignment for patient');
    }
    console.log(
      `[1] Hospital verified: ${country.name} (ID: ${country.countryId})`,
    );

    // 2. Collect all included patients
    console.log('[2] Collecting all patients for Merkle tree');
    const allCitizens = await this.citizenRepository.find({
      relations: ['country'], // Ensure the hospital relation is loaded
    });
    console.log(`[2] Found ${allCitizens.length} total patients`);

    // 3. Prepare leaf rows
    console.log('[3] Preparing Merkle tree leaf rows');
    const citizenRows = allCitizens
      .map(toMerklePatientRow)
      .filter((row) => row.country_id && row.relation && row.citizen_id);
    console.log(
      `[3] Generated ${citizenRows.length} valid leaf rows (filtered from ${citizenRows.length} total)`,
    );

    // 4. The query patient
    console.log('[4] Converting query patient to Merkle format');
    const queryCitizen = toMerklePatientRow(citizen);
    console.log(
      '[4] Query patient data:',
      JSON.stringify(queryCitizen, null, 2),
    );

    // ---- ensure your MerkleManager is ready ----
    console.log('[5] Waiting for MerkleManager to be ready');
    await this.merkleManager.ready; // only needed if using async init (see above)
    console.log('[5] MerkleManager is ready');

    // 5. Get Merkle proof
    console.log('[5] Generating Merkle proof');
    const proof = await this.merkleManager.getProof(citizenRows, queryCitizen);
    console.log('[5] Merkle proof generated successfully');
    console.log('[Root]', proof.merkle_root);
    console.log('[Path]', proof.merkle_path);
    // console.log('[Commitment]', proof.commitment);
    console.log('[Leaf]', proof.merkle_leaf_index);
    // console.log('[Public Inputs]', proof.public_inputs);
    console.log(
      'Sending to generateProof. Path len:',
      proof.merkle_path.length,
      proof.merkle_path,
    );

    if (proof.merkle_path.length !== MERKLE_PATH_LEN) {
      console.error(
        `[ERROR] Invalid Merkle path length: ${proof.merkle_path.length}, expected: ${MERKLE_PATH_LEN}`,
      );
      throw new Error('BUG: backend is about to send a bad path length!');
    }
    console.log('[5] Merkle path length verified');
    // --- BEGIN DETAILED PATH & ROOT DIAGNOSTIC ---
    console.log('[JS-ZKP] --- PATH & ROOT DIAGNOSTIC ---');
    console.log(`[JS-ZKP] Merkle root (hex): ${proof.merkle_root}`);
    (function showHexAndBytes(hex: string, label = '') {
      const h = hex.startsWith('0x') ? hex.slice(2) : hex;
      const arr = Buffer.from(h, 'hex');
      const byteString = Array.from(arr)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      console.log(`${label}${hex} | bytes [${byteString}]`);
    })(proof.merkle_root, '[JS-ZKP] Merkle root: ');

    // Path
    console.log(`[JS-ZKP] Merkle path (length=${proof.merkle_path.length}):`);
    proof.merkle_path.forEach((node, i) => {
      (function (hex: string, idx: number) {
        const h = hex.startsWith('0x') ? hex.slice(2) : hex;
        const arr = Buffer.from(h, 'hex');
        const byteString = Array.from(arr)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ');
        console.log(`[JS-ZKP]   path[${idx}]: ${hex} | bytes [${byteString}]`);
      })(node, i);
    });
    console.log('[JS-ZKP] --- END PATH & ROOT DIAGNOSTIC ---');
    // 6. Prepare Rust payload
    console.log('[6] Preparing payload for Rust ZKP service');
    const payload = {
      ...queryCitizen,
      merkle_leaf_index: proof.merkle_leaf_index,
      merkle_path: proof.merkle_path,
      merkle_root: proof.merkle_root,
      // public_inputs: proof.public_inputs,
    };
    console.log('[6] Rust ZKP payload:', JSON.stringify(payload, null, 2));

    // 7. POST to Rust ZKP microservice
    const rustUrl = `${process.env.ZKP_SERVICE_URL}/generate-proof`;
    console.log(`[7] Sending POST request to ${rustUrl}`);
    const response = await fetch(rustUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log(`[7] Response status: ${response.status}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `[ERROR] Rust microservice error: ${response.status}: ${errorBody}`,
      );
      throw new Error(
        `Rust microservice error: ${response.status}: ${errorBody}`,
      );
    }

    const result = await response.json();
    console.log('[COMPLETE] Successfully generated ZKP proof');
    return result;
  }
}
