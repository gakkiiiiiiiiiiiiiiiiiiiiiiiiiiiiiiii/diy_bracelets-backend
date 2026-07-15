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

  @Column({ type: 'varchar', length: 20, default: 'published' })
  status: 'published' | 'disabled';

  @Column({ default: true })
  isAvailable: boolean;

  @Column({ default: '' })
  crystalFamily: string;

  @Column('simple-json', { nullable: true })
  aliases: string[] | null;

  @Column('simple-json', { nullable: true })
  dominantColors: string[] | null;

  @Column({ default: '' })
  transparency: string;

  @Column({ default: '' })
  pattern: string;

  @Column({ default: '' })
  inclusions: string;

  @Column('simple-json', { nullable: true })
  sourceRefs: string[] | null;

  @Column('simple-json', { nullable: true })
  confidence: Record<string, number> | null;

  @Column({ type: 'varchar', length: 20, default: 'manual' })
  generatedBy: 'imagegen' | 'manual';

  @Column('simple-json', { nullable: true })
  manualOverrides: string[] | null;

  @Column('simple-json', { nullable: true })
  embedding: number[] | null;

  @Column('simple-json', { nullable: true })
  assetBundle: Record<string, string> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
