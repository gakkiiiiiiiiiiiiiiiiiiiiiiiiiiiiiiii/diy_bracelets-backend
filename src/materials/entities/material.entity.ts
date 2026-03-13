import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MaterialSpecEmbed } from './material-spec.embed';

@Entity('materials')
export class Material {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  /** 图片 URL 或相对路径（如 /uploads/xxx.png） */
  @Column({ default: '' })
  image: string;

  @Column()
  categoryId: string;

  @Column('simple-json')
  specs: MaterialSpecEmbed[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
