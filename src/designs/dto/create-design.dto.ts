import { IsString, IsOptional, IsArray, IsNumber, IsIn, Min } from 'class-validator';

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
}
