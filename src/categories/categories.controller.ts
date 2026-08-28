import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateCategoryDto) {
    return this.categoriesService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
