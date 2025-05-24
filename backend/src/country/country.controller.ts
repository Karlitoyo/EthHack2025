import { Body, Controller, Post, ConflictException, InternalServerErrorException, Get } from '@nestjs/common'; // Import exceptions
import { CountryDataDto } from './dto/countryDataDtos';
import { CountryService } from './country';


@Controller('countries')
export class CountryController {

    constructor(private readonly countryService: CountryService) {}

    @Get() // Add GET decorator for fetching all countries
    async findAll() {
        try {
            const countries = await this.countryService.findAllCountries();
            console.log('Successfully fetched all countries');
            return countries;
        } catch (error) {
            console.error(`Error fetching countries: ${error.message}`, error.stack);
            throw new InternalServerErrorException('An unexpected error occurred while fetching countries.');
        }
    }

    @Post('create')
    async createHospital(@Body() countryDataDto: CountryDataDto) {
        try {
            // The service method handles the check and throws ConflictException if needed.
            const country = await this.countryService.createCountry(countryDataDto);
            console.log('Successfully created hospital:', countryDataDto.name);
            return country;
        }
        catch (error) {
            console.error(`Error creating hospital: ${error.message}`, error.stack);
            // Check if it's the specific ConflictException from the service
            if (error instanceof ConflictException) {
                throw error; // Re-throw the ConflictException directly
            }
            // For other unexpected errors, throw a generic server error
            throw new InternalServerErrorException('An unexpected error occurred while creating the country.');
        }
    }
}
