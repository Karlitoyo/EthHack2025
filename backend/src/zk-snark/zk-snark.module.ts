// zk-snark.module.ts
import { Module } from '@nestjs/common';
import { ZkSnarkService } from './zk-snark.service';
import { ZkSnarkController } from './zk-snark.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Relation } from '../relation/relation.entity';
import { Family } from '../family/family.entity';
import { RelationService } from 'src/relation/relation';
import { MerkleService } from '../merkle/merkle.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([Relation, Family]),
  ],
  providers: [ZkSnarkService, RelationService, MerkleService],
  controllers: [ZkSnarkController],
  exports: [ZkSnarkService],    
})
export class ZkSnarkModule {}