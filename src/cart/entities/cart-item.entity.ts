import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export interface CartCompositionSnapshot {
  materialId: string;
  specId: string;
  name: string;
  image: string;
  size: number;
  price: number;
  quantity: number;
  amount: number;
}

@Entity('cart_items')
@Index('UQ_cart_items_user_client', ['userId', 'clientItemId'], { unique: true })
@Index('IDX_cart_items_user_updated', ['userId', 'updatedAt'])
export class CartItemEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 36 }) userId: string;
  @Column({ type: 'varchar', length: 120 }) clientItemId: string;
  @Column({ type: 'varchar', length: 20 }) kind: 'product' | 'custom';
  @Column({ type: 'varchar', length: 100, nullable: true }) productId: string | null;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'text', default: '' }) image: string;
  @Column({ type: 'varchar', length: 80, default: '' }) spec: string;
  @Column({ type: 'int' }) unitPriceCents: number;
  @Column({ type: 'int' }) quantity: number;
  @Column({ type: 'float', nullable: true }) handCircumferenceCm: number | null;
  @Column({ type: 'float', nullable: true }) estimatedCircumferenceCm: number | null;
  @Column('simple-json', { nullable: true }) composition: CartCompositionSnapshot[] | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
