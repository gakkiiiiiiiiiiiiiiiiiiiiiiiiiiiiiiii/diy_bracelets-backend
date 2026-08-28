import { ArrayMaxSize, IsString, IsArray, IsOptional, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DesignCompositionDto, OrderedDesignBeadDto } from '../../designs/dto/create-design.dto';

export class CreateMyDesignDto {
  @IsString()
  @MaxLength(80)
  title: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DesignCompositionDto)
  composition: DesignCompositionDto[];

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderedDesignBeadDto)
  orderedBeads?: OrderedDesignBeadDto[];
}
