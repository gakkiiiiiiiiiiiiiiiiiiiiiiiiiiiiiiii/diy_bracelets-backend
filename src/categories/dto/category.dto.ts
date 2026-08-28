import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: 'id must use lowercase letters, numbers, and hyphens',
  })
  id: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;
}
