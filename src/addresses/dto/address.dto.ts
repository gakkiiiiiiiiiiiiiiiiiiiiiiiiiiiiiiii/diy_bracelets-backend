import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @Length(1, 60)
  @Matches(/\S/)
  name: string;

  @IsString()
  @Matches(/^1\d{10}$/)
  phone: string;

  @IsString()
  @Length(2, 120)
  @Matches(/\S/)
  region: string;

  @IsString()
  @Length(2, 240)
  @Matches(/\S/)
  detail: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  @Length(1, 60)
  @Matches(/\S/)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^1\d{10}$/)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  @Matches(/\S/)
  region?: string;

  @IsOptional()
  @IsString()
  @Length(2, 240)
  @Matches(/\S/)
  detail?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
