import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DesignCompositionEmbed } from './design-composition.embed';

export type DesignSource = 'designer' | 'user';

@Entity('designs')
export class Design {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** designer=后台添加，user=用户发布 */
  @Column({ type: 'varchar', length: 20, default: 'designer' })
  source: DesignSource;

  @Column()
  title: string;

  /** 作者展示，如 @吴烦恼 */
  @Column({ default: '' })
  author: string;

  /** 主图 URL（列表与详情首图） */
  @Column({ default: '' })
  image: string;

  /** 多图时其余图片 URL 数组，JSON 存储 */
  @Column('simple-json', { nullable: true })
  images: string[] | null;

  /** 使用人数，点击「使用该设计」时 +1 */
  @Column({ type: 'int', default: 0 })
  usageCount: number;

  /** 设计构成：材料名、尺寸、单价、数量、金额 */
  @Column('simple-json')
  composition: DesignCompositionEmbed[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
