import { IsString, Length, Matches } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @Matches(/^[A-Za-z0-9._@-]{3,64}$/)
  username: string;

  @IsString()
  @Length(12, 256)
  password: string;
}

export class WechatLoginDto {
  @IsString()
  @Length(1, 256)
  code: string;
}
