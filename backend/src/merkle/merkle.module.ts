import { Module } from '@nestjs/common';
import { MerkleService } from './merkle.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Relation } from '../relation/relation.entity';
import { Family } from '../family/family.entity';
import { MerkleController } from './merkle.controller';

@Module({
  controllers: [MerkleController],
  imports: [TypeOrmModule.forFeature([Relation, Family])],
  exports: [MerkleService],
  providers: [MerkleService]
})
export class MerkleModule {}
