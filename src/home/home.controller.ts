import { Controller, Get } from '@nestjs/common';
import { HomeService } from './home.service';
import { Access } from '../auth/access.decorator';

@Access('public')
@Controller('api/home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  getHome() {
    return this.homeService.getHome();
  }
}
