import { Body, Controller, Post, ConflictException, InternalServerErrorException, Get } from '@nestjs/common';
import { CountryDataDto } from './dto/familyDataDtos'; // DTO still uses Country terminology
import { FamilyService } from './family';


@Controller('families') // Renamed from 'countries' to 'families'
export class FamilyController {

    constructor(private readonly familyService: FamilyService) {}

    @Get()
    async findAll() { // Method to find all families
        try {
            const families = await this.familyService.findAllFamilies(); // Call renamed service method
            console.log('Successfully fetched all families'); // Updated log message
            return families;
        } catch (error) {
            console.error(`Error fetching families: ${error.message}`, error.stack); // Updated log message
            throw new InternalServerErrorException('An unexpected error occurred while fetching families.'); // Updated error message
        }
    }

    @Post('create')
    async createFamily(@Body() familyDataDto: CountryDataDto) { // Renamed method and DTO variable name
        try {
            const family = await this.familyService.createFamily(familyDataDto); // Call renamed service method
            console.log('Successfully created family:', familyDataDto.name); // Updated log message
            return family;
        }
        catch (error) {
            console.error(`Error creating family: ${error.message}`, error.stack); // Updated log message
            if (error instanceof ConflictException) {
                throw error;
            }
            throw new InternalServerErrorException('An unexpected error occurred while creating the family.'); // Updated error message
        }
    }
}
