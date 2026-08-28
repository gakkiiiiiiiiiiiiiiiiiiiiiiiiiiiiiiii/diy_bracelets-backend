import { ArrayMaxSize, IsString, IsOptional, IsArray, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DesignCompositionDto } from '../../designs/dto/create-design.dto';

export class UpdateMyDesignDto {
  @IsString()
  @IsOptional()
  @MaxLength(80)
  title?: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DesignCompositionDto)
  @IsOptional()
  composition?: DesignCompositionDto[];
}
