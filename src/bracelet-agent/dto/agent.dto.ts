import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class CreateAgentGenerationDto {
  @IsOptional() @IsArray() @IsString({ each: true }) colors?: string[];
  @IsOptional() @IsString() referenceImage?: string;
  @IsOptional() @IsNumber() @Min(8) @Max(40) wristCm = 16;
}

class FeedbackBeadDto {
  @IsString() materialId: string;
  @IsString() specId: string;
}

export class CreateAgentFeedbackDto {
  @IsString() generationId: string;
  @IsIn(['accepted', 'modified', 'rejected']) action: 'accepted' | 'modified' | 'rejected';
  @IsOptional() @IsInt() @Min(0) @Max(2) candidateIndex?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FeedbackBeadDto) finalBeads?: FeedbackBeadDto[];
  @IsOptional() @IsString() note?: string;
}

export class RenderAgentBraceletDto {
  @IsNumber() @Min(8) @Max(40) wristCm: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => FeedbackBeadDto) beads: FeedbackBeadDto[];
  @IsOptional() @IsString() styleRef?: string;
}
