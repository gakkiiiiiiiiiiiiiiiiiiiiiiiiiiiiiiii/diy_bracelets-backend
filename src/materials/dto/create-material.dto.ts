import { ArrayMaxSize, ArrayMinSize, IsString, IsArray, ValidateNested, IsNumber, Max, MaxLength, Min, IsOptional, IsBoolean, IsIn, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class MaterialSpecDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  specId?: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  size: number;

  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  price: number;
}

export class CreateMaterialDto {
  @IsString()
  @MaxLength(120)
  id: string;

  @IsString()
  @MaxLength(80)
  name: string;

  @IsString()
  @MaxLength(500)
  image: string;

  @IsString()
  @MaxLength(120)
  categoryId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MaterialSpecDto)
  specs: MaterialSpecDto[];

  @IsOptional()
  @IsIn(['published', 'disabled'])
  status?: 'published' | 'disabled';

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  crystalFamily?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  aliases?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  dominantColors?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  transparency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  pattern?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  inclusions?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  sourceRefs?: string[];

  @IsOptional()
  @IsObject()
  confidence?: Record<string, number>;

  @IsOptional()
  @IsIn(['imagegen', 'manual'])
  generatedBy?: 'imagegen' | 'manual';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  manualOverrides?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4096)
  embedding?: number[];

  @IsOptional()
  @IsObject()
  assetBundle?: Record<string, string>;
}
