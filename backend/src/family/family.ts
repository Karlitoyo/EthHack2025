import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Family } from './family.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CountryDataDto } from './dto/familyDataDtos'; // DTO still uses Country/countryId terminology

@Injectable()
export class FamilyService { // Renamed from CountryService to FamilyService
    constructor(
        @InjectRepository(Family)
        private readonly familyRepository: Repository<Family>, // Renamed from countryRepository
    ) {}

    async findAllFamilies(): Promise<Family[]> { // Renamed from findAllCountries
        return await this.familyRepository.find();
    }
    
    async createFamily(familyData: CountryDataDto): Promise<Family> { // Renamed from createCountry, DTO type kept as CountryDataDto
        // DTO uses countryId and parentCountryId, mapping to Family entity's countryId and parentFamilyId
        const { countryId, parentCountryId, ...otherData } = familyData;

        // Check if a family with the same user-defined countryId already exists
        const existingFamily = await this.familyRepository.findOne({ where: { countryId: countryId } }); // countryId is the public ID
        if (existingFamily) {
            throw new ConflictException(`Family with ID ${countryId} already exists.`); // Updated message
        }

        // Prepare data for the new family entity
        const newFamilyEntityData: Partial<Family> = {
            countryId, // User-defined public ID from DTO
            ...otherData, // Other fields like name, location, relationship etc.
        };

        if (parentCountryId) { // DTO provides parentCountryId
            const parent = await this.familyRepository.findOne({ 
                where: { countryId: parentCountryId } // Find parent by its user-defined public countryId
            });
            if (!parent) {
                throw new NotFoundException(`Parent Family with ID "${parentCountryId}" not found. Cannot link.`); // Updated message
            }
            newFamilyEntityData.parentFamily = parent; // Link the actual entity for the ManyToOne relationship (uses parentFamily)
            newFamilyEntityData.parentFamilyId = parent.id; // Store the internal DB ID of the parent in parentFamilyId
        }

        const newFamily = this.familyRepository.create(newFamilyEntityData);
        console.log('Creating new family:', newFamily); // Updated message
        return await this.familyRepository.save(newFamily);
    }
}
