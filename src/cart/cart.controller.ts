import { Body, Controller, Get, Put } from '@nestjs/common';
import { CartService } from './cart.service';
import { Access } from '../auth/access.decorator';
import { CurrentUserId } from '../auth/current-auth.decorator';
import { ReplaceCartDto } from './dto/cart.dto';

@Access('user')
@Controller('api/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUserId() userId: string) {
    return this.cartService.getCart(userId);
  }

  @Put()
  replaceCart(@CurrentUserId() userId: string, @Body() dto: ReplaceCartDto) {
    return this.cartService.replaceCart(userId, dto.items);
  }
}
