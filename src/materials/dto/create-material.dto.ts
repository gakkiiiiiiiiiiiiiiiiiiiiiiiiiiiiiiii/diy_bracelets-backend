import { IsString, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class MaterialSpecDto {
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
}
