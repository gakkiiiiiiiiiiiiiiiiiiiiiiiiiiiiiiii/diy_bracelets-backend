import { Injectable } from '@nestjs/common';

@Injectable()
export class CartService {
  getCart() {
    return {
      items: [],
    };
  }
}
