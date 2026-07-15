import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateExtractionJobDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceRefs?: string[];
}
