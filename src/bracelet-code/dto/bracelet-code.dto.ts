import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class BraceletCodeBeadDto {
  @IsString() materialId: string;
  @IsString() specId: string;
}

export class EncodeBraceletCodeDto {
  @IsNumber() @Min(8) @Max(40) wristCm: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => BraceletCodeBeadDto) beads: BraceletCodeBeadDto[];
  @IsOptional() @IsString() styleRef?: string;
}

export class ResolveBraceletCodeDto {
  @IsString() code: string;
}
