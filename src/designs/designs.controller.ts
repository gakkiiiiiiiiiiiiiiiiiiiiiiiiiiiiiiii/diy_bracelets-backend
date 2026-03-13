import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { DesignsService } from './designs.service';
import { CreateDesignDto } from './dto/create-design.dto';
import { UpdateDesignDto } from './dto/update-design.dto';

/** 管理端：设计师款 / 用户款 CRUD */
@Controller('api/designs')
export class DesignsController {
  constructor(private readonly designsService: DesignsService) {}

  @Get()
  findAll() {
    return this.designsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.designsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateDesignDto) {
    return this.designsService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateDesignDto) {
    return this.designsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.designsService.remove(id);
  }
}
