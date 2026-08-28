import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_addresses')
@Index('IDX_user_addresses_user_default', ['userId', 'isDefault'])
export class Address {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 36 }) userId: string;
  @Column({ type: 'varchar', length: 60 }) name: string;
  @Column({ type: 'varchar', length: 20 }) phone: string;
  @Column({ type: 'varchar', length: 120 }) region: string;
  @Column({ type: 'varchar', length: 240 }) detail: string;
  @Column({ type: 'boolean', default: false }) isDefault: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
