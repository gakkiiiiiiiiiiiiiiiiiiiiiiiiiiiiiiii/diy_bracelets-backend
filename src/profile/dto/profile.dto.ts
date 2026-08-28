import { IsString, Length, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @Length(1, 40)
  @Matches(/\S/)
  displayName: string;
}
