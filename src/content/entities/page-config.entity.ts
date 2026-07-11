import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PageContent } from '../content.defaults';

@Entity('page_configs')
export class PageConfig {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column('simple-json')
  draftContent: PageContent;

  @Column('simple-json', { nullable: true })
  publishedContent: PageContent | null;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ default: false })
  hasUnpublishedChanges: boolean;

  @Column({ type: 'varchar', length: 32, nullable: true })
  publishedAt: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
