import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';

export class CreateExtractionJobDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  sourceRefs: string[];
}
