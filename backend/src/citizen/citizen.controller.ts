import { Body, Controller, Post, Get, Param, BadRequestException, NotFoundException } from '@nestjs/common'; // Added BadRequestException, NotFoundException
import { CitizenDataDto } from './dto/citizenDataDtos';
import { CitizenService } from './citizen';

@Controller('citizens')
export class CitizenController {
  constructor(private readonly citizenService: CitizenService) {}
    @Post('create')
    async createPatient(@Body() citizenServiceDto: CitizenDataDto) {
      try {
        // The service method now handles the check internally before creation.
        const citizen = await this.citizenService.createPatient(citizenServiceDto);
        console.log('Successfully created patient for treatment:', citizenServiceDto.relationship);
        return citizen;
      } catch (error) {
        console.error(`Error creating patient: ${error.message}`, error.stack);
        if (error instanceof NotFoundException) {
           throw new NotFoundException(`Failed to create citizen: ${error.message}. A country offering the relationship "${citizenServiceDto.relationship}" must exist.`);
        }
        throw error;
      }
    }

    // Renaming and updating the endpoint for clarity and new functionality
  @Get('lineage/:citizenId') // Changed route and parameter name
  async getCitizenLineage(
    @Param('citizenId') citizenId: string, // Changed parameter name
  ) {
    // The service method is already updated to findCitizenInCountrysByRelationship
    return this.citizenService.findCitizenInCountrysByRelationship(citizenId);
  }
}
