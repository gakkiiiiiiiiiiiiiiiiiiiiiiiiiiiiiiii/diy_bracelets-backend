import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Access } from '../auth/access.decorator';
import { CurrentUserId } from '../auth/current-auth.decorator';
import {
  AdminOrderQueryDto,
  AfterSaleDto,
  CreateOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { OrdersService } from './orders.service';

@Access('user')
@Controller('api/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@CurrentUserId() userId: string, @Body() dto: CreateOrderDto) {
    return this.orders.create(userId, dto);
  }

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.orders.findAll(userId);
  }

  @Get(':id')
  findOne(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.orders.findOne(userId, id);
  }

  @Post(':id/remind')
  remind(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.orders.remind(userId, id);
  }

  @Post(':id/confirm-receipt')
  confirmReceipt(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.orders.confirmReceipt(userId, id);
  }

  @Post(':id/after-sale')
  requestAfterSale(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AfterSaleDto,
  ) {
    return this.orders.requestAfterSale(userId, id, dto);
  }
}

@Access('admin')
@Controller('api/admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query() query: AdminOrderQueryDto) {
    return this.orders.findAllAdmin(query.status);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(id, dto);
  }
}
