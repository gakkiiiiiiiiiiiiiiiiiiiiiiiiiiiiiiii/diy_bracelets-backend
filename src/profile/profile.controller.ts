import { Controller, Get } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { Access } from '../auth/access.decorator';

@Access('user')
@Controller('api/profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile() {
    return this.profileService.getProfile();
  }
}
