import { Controller, Get } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { PRODUCT_CATALOG } from './product-catalog';

@Access('public')
@Controller('api/shop-products')
export class ShopProductsController {
  @Get()
  findAll() {
    return {
      items: PRODUCT_CATALOG.map((product) => ({
        id: product.id,
        categoryId: product.categoryId,
        type: product.type,
        name: product.name,
        image: product.image,
        price: product.unitPriceCents / 100,
        sizes: [...product.specs],
      })),
    };
  }
}
