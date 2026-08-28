import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DesignProcessPaletteItemDto, DesignProcessStepDto } from '../dto/design-process-video.dto';

export type DesignProcessVideoStatus = 'queued' | 'rendering' | 'encoding' | 'complete' | 'failed';

@Entity('design_process_videos')
export class DesignProcessVideo {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 36, nullable: true }) ownerId: string | null;
  @Column({ type: 'varchar', length: 20, default: 'queued' }) status: DesignProcessVideoStatus;
  @Column({ type: 'int', default: 0 }) progress: number;
  @Column('simple-json') steps: DesignProcessStepDto[];
  @Column('simple-json', { nullable: true }) palette: DesignProcessPaletteItemDto[] | null;
  @Column({ type: 'float', default: 16 }) wristCm: number;
  @Column({ type: 'text', nullable: true }) videoUrl: string | null;
  @Column({ type: 'int', nullable: true }) durationMs: number | null;
  @Column({ type: 'int', default: 720 }) width: number;
  @Column({ type: 'int', default: 1280 }) height: number;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
