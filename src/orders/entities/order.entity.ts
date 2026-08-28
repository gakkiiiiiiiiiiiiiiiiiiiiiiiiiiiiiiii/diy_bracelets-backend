import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { CanonicalCartItem } from '../../cart/cart.service';

export const ORDER_STATUSES = [
  'pending_confirmation',
  'confirmed',
  'producing',
  'shipped',
  'delivered',
  'after_sale',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderAddressSnapshot {
  id: string;
  name: string;
  phone: string;
  region: string;
  detail: string;
}

@Entity('orders')
@Index('UQ_orders_order_no', ['orderNo'], { unique: true })
@Index('UQ_orders_user_idempotency', ['userId', 'idempotencyKey'], { unique: true })
@Index('IDX_orders_user_created', ['userId', 'createdAt'])
@Index('IDX_orders_status_created', ['status', 'createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 32 }) orderNo: string;
  @Column({ type: 'varchar', length: 36 }) userId: string;
  @Column({ type: 'varchar', length: 30, default: 'pending_confirmation' }) status: OrderStatus;
  @Column({ type: 'varchar', length: 64 }) idempotencyKey: string;
  @Column({ type: 'int' }) itemTotalCents: number;
  @Column({ type: 'int', default: 0 }) freightCents: number;
  @Column({ type: 'int', default: 0 }) discountCents: number;
  @Column({ type: 'int' }) totalCents: number;
  @Column({ type: 'int' }) itemCount: number;
  @Column('simple-json') addressSnapshot: OrderAddressSnapshot;
  @Column('simple-json') items: CanonicalCartItem[];
  @Column({ type: 'text', default: '' }) note: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) trackingCarrier: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) trackingNo: string | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) remindedAt: string | null;
  @Column({ type: 'text', nullable: true }) afterSaleNote: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
