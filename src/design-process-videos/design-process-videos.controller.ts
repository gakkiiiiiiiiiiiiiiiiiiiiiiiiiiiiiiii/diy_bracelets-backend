import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateDesignProcessVideoDto } from './dto/design-process-video.dto';
import { DesignProcessVideosService } from './design-process-videos.service';
import { Access } from '../auth/access.decorator';
import { CurrentUserId } from '../auth/current-auth.decorator';

@Access('user')
@Controller('api/design-process-videos')
export class DesignProcessVideosController {
  constructor(private readonly service: DesignProcessVideosService) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateDesignProcessVideoDto) {
    return this.service.create(userId, dto);
  }

  @Get(':id')
  findOne(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.service.findOne(userId, id);
  }
}
