import { IsString, IsOptional, IsArray, IsBoolean, IsNumber, IsIn, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DesignCompositionDto {
  @IsString()
  materialId: string;

  @IsString()
  name: string;

  @IsString()
  image: string;

  @IsNumber()
  @Min(0)
  size: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class OrderedDesignBeadDto {
  @IsString() materialId: string;
  @IsString() specId: string;
}

export class CreateDesignDto {
  @IsIn(['designer', 'user'])
  source: 'designer' | 'user' = 'designer';

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  author?: string;

  @IsString()
  @IsOptional()
  image?: string;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsArray()
  composition: DesignCompositionDto[];

  @IsOptional()
  @IsArray()
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
  braceletCode?: string;

  @IsOptional()
  @IsBoolean()
  isInspiration?: boolean;

  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  reviewStatus?: 'pending' | 'approved' | 'rejected';
}
