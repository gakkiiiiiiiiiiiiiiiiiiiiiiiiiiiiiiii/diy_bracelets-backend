import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('material_aliases')
export class MaterialAlias {
  @PrimaryColumn()
  fromId: string;

  @Column()
  toId: string;

  @CreateDateColumn()
  createdAt: Date;
}
