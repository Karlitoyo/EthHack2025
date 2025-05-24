// zk-snark.module.ts
import { Module } from '@nestjs/common';
import { ZkSnarkService } from './zk-snark.service';
import { ZkSnarkController } from './zk-snark.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Citizen } from '../citizen/citizen.entity';
import { Country } from '../country/country.entity';
import { CitizenService } from 'src/citizen/citizen';
import { MerkleService } from '../merkle/merkle.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([Citizen, Country]),
  ],
  providers: [ZkSnarkService, CitizenService, MerkleService],
  controllers: [ZkSnarkController],
  exports: [ZkSnarkService],    
})
export class ZkSnarkModule {}