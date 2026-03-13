import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DesignCompositionDto } from '../../designs/dto/create-design.dto';

export class CreateMyDesignDto {
  @IsString()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DesignCompositionDto)
  composition: DesignCompositionDto[];
}
