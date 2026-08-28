import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreateAgentGenerationDto {
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true }) @MaxLength(32, { each: true }) colors?: string[];
  @IsOptional() @IsString() @MaxLength(500) referenceImage?: string;
  @IsOptional() @IsNumber() @Min(8) @Max(40) wristCm = 16;
}

class FeedbackBeadDto {
  @IsString() @MaxLength(120) materialId: string;
  @IsString() @MaxLength(120) specId: string;
}

export class CreateAgentFeedbackDto {
  @IsUUID() generationId: string;
  @IsIn(['accepted', 'modified', 'rejected']) action: 'accepted' | 'modified' | 'rejected';
  @IsOptional() @IsInt() @Min(0) @Max(2) candidateIndex?: number;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => FeedbackBeadDto) finalBeads?: FeedbackBeadDto[];
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class RenderAgentBraceletDto {
  @IsNumber() @Min(8) @Max(40) wristCm: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => FeedbackBeadDto) beads: FeedbackBeadDto[];
  @IsOptional() @IsString() @MaxLength(120) styleRef?: string;
}
