import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { MyDesignsService } from './my-designs.service';
import { CreateMyDesignDto } from './dto/create-my-design.dto';
import { UpdateMyDesignDto } from './dto/update-my-design.dto';

/** 用户「我的设计」：列表、新增、更新、删除 */
@Controller('api/my-designs')
export class MyDesignsController {
  constructor(private readonly myDesignsService: MyDesignsService) {}

  @Get()
  findAll() {
    return this.myDesignsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.myDesignsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateMyDesignDto) {
    return this.myDesignsService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateMyDesignDto) {
    return this.myDesignsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.myDesignsService.remove(id);
  }
}
