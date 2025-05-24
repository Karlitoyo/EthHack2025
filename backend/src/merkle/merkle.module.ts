import { Module } from '@nestjs/common';
import { MerkleService } from './merkle.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Citizen } from '../citizen/citizen.entity';
import { Country } from '../country/country.entity';
import { MerkleController } from './merkle.controller';

@Module({
  controllers: [MerkleController],
  imports: [TypeOrmModule.forFeature([Citizen, Country])],
  exports: [MerkleService],
  providers: [MerkleService]
})
export class MerkleModule {}
