import { ArrayMaxSize, ArrayMinSize, IsString, IsOptional, IsArray, IsBoolean, IsInt, IsNumber, IsIn, MaxLength, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DesignCompositionDto {
  @IsString() @MaxLength(120)
  materialId: string;

  @IsOptional() @IsString() @MaxLength(120)
  specId?: string;

  @IsString() @MaxLength(80)
  name: string;

  @IsString() @MaxLength(500)
  image: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  size: number;

  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  price: number;

  @IsInt()
  @Min(1)
  @Max(300)
  quantity: number;
}

export class OrderedDesignBeadDto {
  @IsString() @MaxLength(120) materialId: string;
  @IsString() @MaxLength(120) specId: string;
}

export class CreateDesignDto {
  @IsIn(['designer', 'user', 'contest'])
  source: 'designer' | 'user' | 'contest' = 'designer';

  @IsString() @MaxLength(80)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  author?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  image?: string;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  images?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => DesignCompositionDto)
  composition: DesignCompositionDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => OrderedDesignBeadDto)
  orderedBeads?: OrderedDesignBeadDto[];

  @IsOptional()
  @IsNumber()
  @Min(8)
  @Max(40)
  wristCm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  braceletCode?: string;

  @IsOptional()
  @IsBoolean()
  isInspiration?: boolean;

  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  reviewStatus?: 'pending' | 'approved' | 'rejected';
}
