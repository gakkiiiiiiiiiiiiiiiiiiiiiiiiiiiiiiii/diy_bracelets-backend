import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageContent } from '../content.defaults';

export class UpdatePageConfigDto {
  @IsObject()
  content: PageContent;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
