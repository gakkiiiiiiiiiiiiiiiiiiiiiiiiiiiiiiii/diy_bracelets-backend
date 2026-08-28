import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Material } from '../materials/entities/material.entity';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartItemEntity } from './entities/cart-item.entity';
import { ShopProductsController } from './shop-products.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CartItemEntity, Material])],
  controllers: [CartController, ShopProductsController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
