import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class BraceletCodeBeadDto {
  @IsString() @MaxLength(120) materialId: string;
  @IsString() @MaxLength(120) specId: string;
}

export class EncodeBraceletCodeDto {
  @IsNumber() @Min(8) @Max(40) wristCm: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => BraceletCodeBeadDto) beads: BraceletCodeBeadDto[];
  @IsOptional() @IsString() @MaxLength(120) styleRef?: string;
}

export class ResolveBraceletCodeDto {
  @IsString() @MaxLength(4096) code: string;
}
