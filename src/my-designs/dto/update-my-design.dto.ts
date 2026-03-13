import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DesignCompositionDto } from '../../designs/dto/create-design.dto';

export class UpdateMyDesignDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DesignCompositionDto)
  @IsOptional()
  composition?: DesignCompositionDto[];
}
