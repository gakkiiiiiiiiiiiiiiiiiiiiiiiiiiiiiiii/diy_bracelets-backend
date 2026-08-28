import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DesignCompositionEmbed } from './design-composition.embed';

export type DesignSource = 'designer' | 'user' | 'contest';
export type DesignReviewStatus = 'pending' | 'approved' | 'rejected';

@Entity('designs')
export class Design {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  ownerId: string | null;

  /** designer=设计师款，user=用户发布，contest=设计大赛专区 */
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

  /** 可精确复现的有序珠子序列；旧设计可为空 */
  @Column('simple-json', { nullable: true })
  orderedBeads: Array<{ materialId: string; specId: string }> | null;

  @Column({ type: 'float', nullable: true })
  wristCm: number | null;

  @Column({ type: 'text', nullable: true })
  braceletCode: string | null;

  /** 是否公开到灵感岛；设计库中的草稿可保持 false。 */
  @Column({ type: 'boolean', default: true })
  isInspiration: boolean;

  /** 用户投稿需审核，后台/Agent 发布可直接通过。 */
  @Column({ type: 'varchar', length: 20, default: 'approved' })
  reviewStatus: DesignReviewStatus;

  @Column({ type: 'text', nullable: true })
  reviewNote: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  reviewedAt: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
