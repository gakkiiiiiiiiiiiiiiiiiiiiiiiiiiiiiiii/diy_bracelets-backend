import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [ContentModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
