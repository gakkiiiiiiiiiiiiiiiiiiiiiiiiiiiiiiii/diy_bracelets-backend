import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ContentService } from './content.service';
import { UpdatePageConfigDto } from './dto/update-page-config.dto';

@Controller('api/content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  findAll() {
    return this.contentService.findAll();
  }

  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.contentService.findOne(key);
  }

  @Put(':key')
  update(
    @Param('key') key: string,
    @Body() body: UpdatePageConfigDto,
  ) {
    return this.contentService.update(key, body);
  }
}
