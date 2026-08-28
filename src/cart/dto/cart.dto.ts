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
  Length,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CartCompositionDto {
  @IsString()
  @Length(1, 255)
  materialId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  specId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(1)
  @Max(100)
  size: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  quantity: number;
}

export class CartItemDto {
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  clientItemId: string;

  @IsIn(['product', 'custom'])
  kind: 'product' | 'custom';

  @ValidateIf((item: CartItemDto) => item.kind === 'product')
  @IsString()
  @Length(1, 100)
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  spec?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  qty: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(5)
  @Max(50)
  handCircumferenceCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  estimatedCircumferenceCm?: number;

  @ValidateIf((item: CartItemDto) => item.kind === 'custom')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CartCompositionDto)
  composition?: CartCompositionDto[];
}

export class ReplaceCartDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];
}
