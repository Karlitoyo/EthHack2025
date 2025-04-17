import { Body, Controller, Post } from '@nestjs/common';
import { HospitalDataDto } from './dto/hospitalDataDtos';
import { HospitalService } from './hospitals';


@Controller('hospitals')
export class HospitalsController {

    constructor(private readonly hospitalService: HospitalService) {}

    @Post('create')
    async createHospital(@Body() hospitalDataDto: HospitalDataDto) {
        try {
            // Here you would typically call a service to handle the logic
            const hospital = await this.hospitalService.createHospital(hospitalDataDto);
            console.log('Received hospital data:', hospitalDataDto);
            return hospital;
        }
        catch (error) {
            console.error('Error creating hospital:', error);
            throw new Error('Failed to create hospital');
        }
    }
}
