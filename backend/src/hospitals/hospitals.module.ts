import { Module } from '@nestjs/common';
import { HospitalsController } from './hospitals.controller';
import { Hospital } from './hospital.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HospitalService } from './hospitals';

@Module({
  imports: [TypeOrmModule.forFeature([Hospital])],
  controllers: [HospitalsController],
  providers: [HospitalService],
  exports: [HospitalService],
})
export class HospitalsModule {}
