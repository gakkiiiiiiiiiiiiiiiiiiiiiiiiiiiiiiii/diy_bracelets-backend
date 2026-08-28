import { Controller, Get } from '@nestjs/common';
import { CartService } from './cart.service';
import { Access } from '../auth/access.decorator';

@Access('user')
@Controller('api/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart() {
    return this.cartService.getCart();
  }
}
