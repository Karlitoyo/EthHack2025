import { IsNotEmpty, IsString } from 'class-validator';

export class GenerateLineageProofDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
