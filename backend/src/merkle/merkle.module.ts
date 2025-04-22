import { Module } from '@nestjs/common';
import { MerkleService } from './merkle.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../patients/patient.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { MerkleController } from './merkle.controller';

@Module({
  controllers: [MerkleController],
  imports: [TypeOrmModule.forFeature([Patient, Hospital])],
  exports: [MerkleService],
  providers: [MerkleService]
})
export class MerkleModule {}
