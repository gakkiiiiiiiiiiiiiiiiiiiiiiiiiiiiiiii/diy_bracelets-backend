import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateDesignProcessVideoDto } from './dto/design-process-video.dto';
import { DesignProcessVideosService } from './design-process-videos.service';

@Controller('api/design-process-videos')
export class DesignProcessVideosController {
  constructor(private readonly service: DesignProcessVideosService) {}

  @Post()
  create(@Body() dto: CreateDesignProcessVideoDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
