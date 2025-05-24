import { Module } from '@nestjs/common';
import { CountryController } from './country.controller';
import { Country } from './country.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CountryService } from './country';

@Module({
  imports: [TypeOrmModule.forFeature([Country])],
  controllers: [CountryController],
  providers: [CountryService],
  exports: [CountryService],
})
export class CountryModule {}
