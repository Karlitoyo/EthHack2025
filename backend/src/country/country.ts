import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Country } from './country.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CountryDataDto } from './dto/countryDataDtos';

@Injectable()
export class CountryService {
    constructor(
        @InjectRepository(Country)
        private readonly countryRepository: Repository<Country>,
    ) {}

    async findAllCountries(): Promise<Country[]> { // Add findAllCountries method
        return await this.countryRepository.find();
    }
    
    async createCountry(countryData: CountryDataDto): Promise<Country> {
        const { countryId, parentCountryId, ...otherData } = countryData;

        // Check if a country with the same user-defined countryId already exists
        const existingCountry = await this.countryRepository.findOne({ where: { countryId: countryId } });
        if (existingCountry) {
            throw new ConflictException(`Country with ID ${countryId} already exists.`);
        }

        // Prepare data for the new country entity
        const newCountryEntityData: Partial<Country> = {
            countryId, // User-defined ID from DTO
            ...otherData, // Other fields like name, location, relationship etc.
        };

        if (parentCountryId) {
            const parent = await this.countryRepository.findOne({ 
                where: { countryId: parentCountryId } // Find parent by its user-defined countryId
            });
            if (!parent) {
                throw new NotFoundException(`Parent Country with ID "${parentCountryId}" not found. Cannot link.`);
            }
            newCountryEntityData.parentCountry = parent; // Link the actual entity for the ManyToOne relationship
            newCountryEntityData.parentCountryId = parentCountryId; // Store the user-defined string ID of the parent in the dedicated column
        }

        const newCountry = this.countryRepository.create(newCountryEntityData);
        console.log('Creating new country:', newCountry);
        return await this.countryRepository.save(newCountry);
    }
}
