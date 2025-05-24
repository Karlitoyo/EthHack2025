import { Module } from '@nestjs/common';
import { RelationController } from './relation.controller';
import { Relation } from './relation.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RelationService } from './relation';
import { Family } from '../family/family.entity';
import { ZkSnarkService } from '../zk-snark/zk-snark.service';
import { MerkleService } from '../merkle/merkle.service';

@Module({
  imports: [TypeOrmModule.forFeature([Relation, Family])],
  providers: [RelationService, ZkSnarkService, MerkleService],
  exports: [RelationService],
  controllers: [RelationController],
})
export class CitizenModule {}
