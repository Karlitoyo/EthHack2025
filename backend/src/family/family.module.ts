import { Module } from '@nestjs/common';
import { FamilyController } from './family.controller';
import { Family } from './family.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FamilyService } from './family';

@Module({
  imports: [TypeOrmModule.forFeature([Family])],
  controllers: [FamilyController],
  providers: [FamilyService],
  exports: [FamilyService],
})
export class CountryModule {}
