import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { MyDesignsService } from './my-designs.service';
import { CreateMyDesignDto } from './dto/create-my-design.dto';
import { UpdateMyDesignDto } from './dto/update-my-design.dto';
import { Access } from '../auth/access.decorator';
import { CurrentUserId } from '../auth/current-auth.decorator';

/** 用户「我的设计」：列表、新增、更新、删除 */
@Access('user')
@Controller('api/my-designs')
export class MyDesignsController {
  constructor(private readonly myDesignsService: MyDesignsService) {}

  @Get()
  findAll(@CurrentUserId() userId: string) {
    return this.myDesignsService.findAll(userId);
  }

  @Get(':id')
  findOne(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.myDesignsService.findOne(userId, id);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() body: CreateMyDesignDto) {
    return this.myDesignsService.create(userId, body);
  }

  @Patch(':id')
  update(@CurrentUserId() userId: string, @Param('id') id: string, @Body() body: UpdateMyDesignDto) {
    return this.myDesignsService.update(userId, id, body);
  }

  @Delete(':id')
  remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.myDesignsService.remove(userId, id);
  }
}
