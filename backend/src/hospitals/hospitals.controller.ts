import { Body, Controller, Post, ConflictException, InternalServerErrorException } from '@nestjs/common'; // Import exceptions
import { HospitalDataDto } from './dto/hospitalDataDtos';
import { HospitalService } from './hospitals';


@Controller('hospitals')
export class HospitalsController {

    constructor(private readonly hospitalService: HospitalService) {}

    @Post('create')
    async createHospital(@Body() hospitalDataDto: HospitalDataDto) {
        try {
            // The service method handles the check and throws ConflictException if needed.
            const hospital = await this.hospitalService.createHospital(hospitalDataDto);
            console.log('Successfully created hospital:', hospitalDataDto.name);
            return hospital;
        }
        catch (error) {
            console.error(`Error creating hospital: ${error.message}`, error.stack);
            // Check if it's the specific ConflictException from the service
            if (error instanceof ConflictException) {
                throw error; // Re-throw the ConflictException directly
            }
            // For other unexpected errors, throw a generic server error
            throw new InternalServerErrorException('An unexpected error occurred while creating the hospital.');
        }
    }
}
