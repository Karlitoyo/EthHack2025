import { Body, Controller, Post, Get, Param, BadRequestException, NotFoundException } from '@nestjs/common'; // Added BadRequestException, NotFoundException
import { PatientDataDto } from './dto/patientDataDtos';
import { PatientService } from './patients';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientService: PatientService) {}
    @Post('create')
    async createPatient(@Body() patientDataDto: PatientDataDto) {
      try {
        // The service method now handles the check internally before creation.
        const patient = await this.patientService.createPatient(patientDataDto);
        console.log('Successfully created patient for treatment:', patientDataDto.treatment);
        return patient;
      } catch (error) {
        console.error(`Error creating patient: ${error.message}`, error.stack);
        if (error instanceof NotFoundException) {
           throw new NotFoundException(`Failed to create patient: ${error.message}. A hospital offering the treatment "${patientDataDto.treatment}" must exist.`);
        }
        throw error;
      }
    }

    // ... rest of the controller methods

  @Get('treatment/:treatment')
  async getHospitalsAndPatientsByTreatment(
    @Param('treatment') treatment: string,
  ) {
    return this.patientService.findPatientsInHospitalsByTreatment(treatment);
  }
}
