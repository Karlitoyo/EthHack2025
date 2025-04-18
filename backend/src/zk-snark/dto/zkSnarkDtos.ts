import { IsNotEmpty, IsNumber, IsDateString, IsString } from 'class-validator';

export class ZkSnarkDto {
  @IsNotEmpty()
  @IsNumber()
  patient_id: string;

  @IsNotEmpty()
  @IsString()
  treatment: string;

  @IsNotEmpty()
  @IsString()
  hospital_id: string;
}
