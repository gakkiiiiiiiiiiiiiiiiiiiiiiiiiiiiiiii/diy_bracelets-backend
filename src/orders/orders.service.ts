import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { AddressesService } from '../addresses/addresses.service';
import { CartService } from '../cart/cart.service';
import { CartItemEntity } from '../cart/entities/cart-item.entity';
import { AfterSaleDto, CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { Order, OrderStatus } from './entities/order.entity';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_confirmation: '待确认',
  confirmed: '待制作',
  producing: '制作中',
  shipped: '已发货',
  delivered: '已收货',
  after_sale: '退款/售后',
  cancelled: '已取消',
};

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['producing', 'cancelled'],
  producing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'after_sale'],
  delivered: ['after_sale'],
  after_sale: ['delivered', 'cancelled'],
  cancelled: [],
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    private readonly addresses: AddressesService,
    private readonly cart: CartService,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    const existing = await this.orders.findOne({ where: { userId, idempotencyKey: dto.idempotencyKey } });
    if (existing) return this.toApi(existing);

    const [address, items] = await Promise.all([
      this.addresses.findOwned(userId, dto.addressId),
      this.cart.canonicalizeItems(dto.items),
    ]);
    const itemTotalCents = items.reduce(
      (sum, item) => sum + Math.round(item.price * 100) * item.qty,
      0,
    );
    const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
    if (itemTotalCents <= 0 || itemTotalCents > 100_000_000) {
      throw new BadRequestException('订单金额超出允许范围');
    }

    try {
      const order = await this.dataSource.transaction(async (manager) => {
        const saved = await manager.save(Order, manager.create(Order, {
          orderNo: this.createOrderNo(),
          userId,
          status: 'pending_confirmation',
          idempotencyKey: dto.idempotencyKey,
          itemTotalCents,
          freightCents: 0,
          discountCents: 0,
          totalCents: itemTotalCents,
          itemCount,
          addressSnapshot: {
            id: address.id,
            name: address.name,
            phone: address.phone,
            region: address.region,
            detail: address.detail,
          },
          items,
          note: dto.note?.trim() ?? '',
          trackingCarrier: null,
          trackingNo: null,
          remindedAt: null,
          afterSaleNote: null,
        }));
        const selectedIds = [...new Set(dto.cartItemIds ?? [])];
        if (selectedIds.length) {
          await manager.createQueryBuilder()
            .delete()
            .from(CartItemEntity)
            .where('userId = :userId', { userId })
            .andWhere('clientItemId IN (:...selectedIds)', { selectedIds })
            .execute();
        }
        return saved;
      });
      return this.toApi(order);
    } catch (error) {
      const duplicate = await this.orders.findOne({ where: { userId, idempotencyKey: dto.idempotencyKey } });
      if (duplicate) return this.toApi(duplicate);
      throw error;
    }
  }

  async findAll(userId: string) {
    const orders = await this.orders.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 200 });
    return orders.map((order) => this.toApi(order));
  }

  async findOne(userId: string, id: string) {
    return this.toApi(await this.findOwned(userId, id));
  }

  async remind(userId: string, id: string) {
    const order = await this.findOwned(userId, id);
    if (!['pending_confirmation', 'confirmed', 'producing'].includes(order.status)) {
      throw new ConflictException('当前订单状态无需提醒');
    }
    const last = order.remindedAt ? new Date(order.remindedAt).getTime() : 0;
    if (last && Date.now() - last < 6 * 60 * 60 * 1_000) {
      throw new HttpException('请勿频繁提醒，客服已收到上一次请求', 429);
    }
    order.remindedAt = new Date().toISOString();
    return this.toApi(await this.orders.save(order));
  }

  async confirmReceipt(userId: string, id: string) {
    const order = await this.findOwned(userId, id);
    if (order.status !== 'shipped') throw new ConflictException('只有已发货订单可以确认收货');
    order.status = 'delivered';
    return this.toApi(await this.orders.save(order));
  }

  async requestAfterSale(userId: string, id: string, dto: AfterSaleDto) {
    const order = await this.findOwned(userId, id);
    if (!['shipped', 'delivered'].includes(order.status)) {
      throw new ConflictException('当前订单状态无法申请售后');
    }
    order.status = 'after_sale';
    order.afterSaleNote = dto.note.trim();
    return this.toApi(await this.orders.save(order));
  }

  async findAllAdmin(status?: OrderStatus) {
    const orders = await this.orders.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: 500,
    });
    return orders.map((order) => this.toApi(order, true));
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('订单不存在');
    if (!ALLOWED_TRANSITIONS[order.status].includes(dto.status)) {
      throw new ConflictException(`不能从 ${STATUS_LABELS[order.status]} 变更为 ${STATUS_LABELS[dto.status]}`);
    }
    order.status = dto.status;
    if (dto.status === 'shipped') {
      order.trackingCarrier = dto.trackingCarrier!.trim();
      order.trackingNo = dto.trackingNo!.trim();
    }
    return this.toApi(await this.orders.save(order), true);
  }

  private async findOwned(userId: string, id: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id, userId } });
    if (!order) throw new NotFoundException('订单不存在');
    return order;
  }

  private createOrderNo(): string {
    const now = new Date();
    const date = [
      now.getUTCFullYear(),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      String(now.getUTCDate()).padStart(2, '0'),
    ].join('');
    return `ZD${date}${randomBytes(6).toString('hex').toUpperCase()}`;
  }

  private toApi(order: Order, includeUserId = false) {
    const items = order.items.map((item) => ({ ...item, id: item.clientItemId }));
    const primaryName = items[0]?.name || '定制手串';
    return {
      id: order.id,
      orderNo: order.orderNo,
      ...(includeUserId ? { userId: order.userId } : {}),
      title: items.length > 1 ? `${primaryName} 等 ${items.length} 件` : primaryName,
      status: STATUS_LABELS[order.status],
      statusCode: order.status,
      total: order.totalCents / 100,
      itemTotal: order.itemTotalCents / 100,
      freight: order.freightCents / 100,
      discount: order.discountCents / 100,
      note: order.note,
      address: order.addressSnapshot,
      itemCount: order.itemCount,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items,
      trackingCarrier: order.trackingCarrier,
      trackingNo: order.trackingNo,
      remindedAt: order.remindedAt,
      afterSaleNote: order.afterSaleNote,
    };
  }
}
