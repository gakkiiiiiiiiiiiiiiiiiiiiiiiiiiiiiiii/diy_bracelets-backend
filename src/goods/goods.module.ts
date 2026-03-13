import { Module } from '@nestjs/common';
import { GoodsController } from './goods.controller';
import { GoodsService } from './goods.service';
import { DesignsModule } from '../designs/designs.module';

@Module({
  imports: [DesignsModule],
  controllers: [GoodsController],
  providers: [GoodsService],
})
export class GoodsModule {}
