import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { GoodsService } from './goods.service';

@Controller('api/goods')
export class GoodsController {
  constructor(private readonly goodsService: GoodsService) {}

  @Get()
  getGoods(@Query('tab') tab?: string) {
    return this.goodsService.getGoods(tab);
  }

  @Get(':id')
  getGoodsById(@Param('id') id: string) {
    return this.goodsService.getGoodsById(id);
  }

  @Post(':id/use')
  useDesign(@Param('id') id: string) {
    return this.goodsService.useDesign(id);
  }
}
