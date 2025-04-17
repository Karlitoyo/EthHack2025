import { Body, Controller, Post, Get, Param } from '@nestjs/common';
import { PatientDataDto } from './dto/patientDataDtos';
import { PatientService } from './patients';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientService: PatientService) {}

  @Post('create')
  async createPatient(@Body() PatientDataDto: PatientDataDto) {
    try {
      // Here you would typically call a service to handle the logic
      const patient = await this.patientService.createPatient(PatientDataDto);
      console.log('Received patient data:', PatientDataDto);
      return patient;
    } catch (error) {
      console.error('Error creating patient:', error);
      throw new Error('Failed to create patient');
    }
  }

  @Get('treatment/:treatment')
  async getHospitalsAndPatientsByTreatment(
    @Param('treatment') treatment: string,
  ) {
    return this.patientService.findPatientsInHospitalsByTreatment(treatment);
  }
}
