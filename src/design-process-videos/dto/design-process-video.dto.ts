import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class DesignProcessBeadDto {
  @IsString() materialId: string;
  @IsString() specId: string;
  @IsString() name: string;
  @IsString() image: string;
  @IsNumber() @Min(4) @Max(30) size: number;
  @IsNumber() @Min(0) @Max(100000) price: number;
  @IsOptional() @IsInt() @Min(0) orderIndex?: number;
}

export class DesignProcessPaletteItemDto {
  @IsString() materialId: string;
  @IsString() name: string;
  @IsString() image: string;
  @IsNumber() @Min(4) @Max(30) size: number;
  @IsNumber() @Min(0) @Max(100000) price: number;
}

export class DesignProcessStepDto {
  @IsString() id: string;
  @IsIn(['start', 'add', 'move', 'remove', 'replace', 'clear', 'apply'])
  action: 'start' | 'add' | 'move' | 'remove' | 'replace' | 'clear' | 'apply';
  @IsNumber() at: number;
  @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => DesignProcessBeadDto)
  beads: DesignProcessBeadDto[];
  @IsOptional() @IsInt() @Min(0) fromIndex?: number;
  @IsOptional() @IsInt() @Min(0) toIndex?: number;
}

export class CreateDesignProcessVideoDto {
  @IsArray() @ArrayMaxSize(120) @ValidateNested({ each: true }) @Type(() => DesignProcessStepDto)
  steps: DesignProcessStepDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => DesignProcessPaletteItemDto)
  palette?: DesignProcessPaletteItemDto[];
  @IsOptional() @IsNumber() @Min(8) @Max(40) wristCm = 16;
}

export class UploadDesignProcessFrameDto {
  @IsString() imageBase64: string;
}
