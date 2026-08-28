import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { Access } from '../auth/access.decorator';
import { CurrentUserId } from '../auth/current-auth.decorator';
import { UpdateProfileDto } from './dto/profile.dto';

@Access('user')
@Controller('api/profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@CurrentUserId() userId: string) {
    return this.profileService.getProfile(userId);
  }

  @Patch()
  updateProfile(@CurrentUserId() userId: string, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(userId, dto);
  }
}
