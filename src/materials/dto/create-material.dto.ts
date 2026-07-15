import { IsString, IsArray, ValidateNested, IsNumber, Min, IsOptional, IsBoolean, IsIn, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class MaterialSpecDto {
  @IsString()
  @IsOptional()
  specId?: string;

  @IsNumber()
  @Min(1)
  size: number;

  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateMaterialDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  image: string;

  @IsString()
  categoryId: string;

  @IsArray()
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
  crystalFamily?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dominantColors?: string[];

  @IsOptional()
  @IsString()
  transparency?: string;

  @IsOptional()
  @IsString()
  pattern?: string;

  @IsOptional()
  @IsString()
  inclusions?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceRefs?: string[];

  @IsOptional()
  @IsObject()
  confidence?: Record<string, number>;

  @IsOptional()
  @IsIn(['imagegen', 'manual'])
  generatedBy?: 'imagegen' | 'manual';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  manualOverrides?: string[];

  @IsOptional()
  @IsArray()
  embedding?: number[];

  @IsOptional()
  @IsObject()
  assetBundle?: Record<string, string>;
}
