import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class DesignProcessBeadDto {
  @IsOptional() @IsString() @MaxLength(120) id?: string;
  @IsString() @MaxLength(255) materialId: string;
  @IsString() @MaxLength(100) specId: string;
  @IsString() @MaxLength(120) name: string;
  @IsString() @MaxLength(1_000) image: string;
  @IsNumber() @Min(4) @Max(30) size: number;
  @IsNumber() @Min(0) @Max(100000) price: number;
  @IsOptional() @IsInt() @Min(0) orderIndex?: number;
}

export class DesignProcessPaletteItemDto {
  @IsString() @MaxLength(255) materialId: string;
  @IsOptional() @IsString() @MaxLength(100) specId?: string;
  @IsString() @MaxLength(120) name: string;
  @IsString() @MaxLength(1_000) image: string;
  @IsNumber() @Min(4) @Max(30) size: number;
  @IsNumber() @Min(0) @Max(100000) price: number;
}

export class DesignProcessStepDto {
  @IsString() @MaxLength(120) id: string;
  @IsIn(['start', 'add', 'move', 'remove', 'replace', 'clear', 'apply'])
  action: 'start' | 'add' | 'move' | 'remove' | 'replace' | 'clear' | 'apply';
  @IsNumber() at: number;
  @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => DesignProcessBeadDto)
  beads: DesignProcessBeadDto[];
  @IsOptional() @IsInt() @Min(0) fromIndex?: number;
  @IsOptional() @IsInt() @Min(0) toIndex?: number;
}

export class CreateDesignProcessVideoDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(120) @ValidateNested({ each: true }) @Type(() => DesignProcessStepDto)
  steps: DesignProcessStepDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => DesignProcessPaletteItemDto)
  palette?: DesignProcessPaletteItemDto[];
  @IsOptional() @IsNumber() @Min(8) @Max(40) wristCm = 16;
}
