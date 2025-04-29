import { Injectable } from '@nestjs/common';
import { Hospital } from './hospital.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { HospitalDataDto } from './dto/hospitalDataDtos';
import { ConflictException } from '@nestjs/common';

@Injectable()
export class HospitalService {
    constructor(
        @InjectRepository(Hospital)
        private readonly hospitalRepository: Repository<Hospital>,
    ) {}
    
    async createHospital(hospitalData: HospitalDataDto): Promise<Hospital> {
        const existingHospital = await this.hospitalRepository.findOne({ where: { id: hospitalData.hospitalId } });
        if (existingHospital) {
            throw new ConflictException(`Hospital with ID ${hospitalData.hospitalId} already exists.`);
        }
        const newHospital = this.hospitalRepository.create({...hospitalData});
        console.log('Creating new hospital:', newHospital);
        return await this.hospitalRepository.save(newHospital);
    }
}
