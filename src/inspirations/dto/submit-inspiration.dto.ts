import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { DesignCompositionDto, OrderedDesignBeadDto } from '../../designs/dto/create-design.dto';

export class SubmitInspirationDto {
  @IsString()
  @MaxLength(40)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  author?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => DesignCompositionDto)
  composition: DesignCompositionDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => OrderedDesignBeadDto)
  orderedBeads: OrderedDesignBeadDto[];

  @IsOptional()
  @IsNumber()
  @Min(8)
  @Max(40)
  wristCm?: number;
}

export class ReviewInspirationDto {
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
