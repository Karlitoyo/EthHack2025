import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CountryDataDto {
  @IsNotEmpty()
  @IsString()
  countryId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  location: string;

  @IsNotEmpty()
  @IsString()
  relationship: string;

  @IsNotEmpty()
  @IsString()
  contactNumber: string;

  @IsNotEmpty()
  @IsString()
  capacity: string;

  @IsNotEmpty()
  @IsString()
  adminName: string;

  @IsOptional()
  @IsString()
  parentFamilyId?: string;
}
