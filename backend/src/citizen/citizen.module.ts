import { Module } from '@nestjs/common';
import { CitizenController } from './citizen.controller';
import { Citizen } from './citizen.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CitizenService } from './citizen';
import { Country } from '../country/country.entity';
import { ZkSnarkService } from '../zk-snark/zk-snark.service';
import { MerkleService } from '../merkle/merkle.service';

@Module({
  imports: [TypeOrmModule.forFeature([Citizen, Country])],
  providers: [CitizenService, ZkSnarkService, MerkleService],
  exports: [CitizenService],
  controllers: [CitizenController],
})
export class CitizenModule {}
