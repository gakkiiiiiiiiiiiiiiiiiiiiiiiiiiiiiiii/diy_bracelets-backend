import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DesignCompositionEmbed } from '../../designs/entities/design-composition.embed';

/** 用户「我的设计」：本地保存的设计列表，与设计广场 Design 区分 */
@Entity('saved_designs')
export class SavedDesign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  userId: string | null;

  @Column()
  title: string;

  @Column('simple-json')
  composition: DesignCompositionEmbed[];

  @Column('simple-json', { nullable: true })
  orderedBeads: Array<{ materialId: string; specId: string }> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
