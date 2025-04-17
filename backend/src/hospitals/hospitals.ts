import { Injectable } from '@nestjs/common';
import { Hospital } from './hospital.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { HospitalDataDto } from './dto/hospitalDataDtos';


@Injectable()
export class HospitalService {
    constructor(
        @InjectRepository(Hospital)
        private readonly hospitalRepository: Repository<Hospital>,
    ) {}
    
    async createHospital(hospitalData: HospitalDataDto): Promise<Hospital> {
        const newHospital = this.hospitalRepository.create({...hospitalData});
        console.log('Creating new hospital:', newHospital);
        return await this.hospitalRepository.save(newHospital);
    }
}
