import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type ExtractionJobStatus = 'queued' | 'recognizing' | 'deduplicating' | 'extracting' | 'removing_background' | 'validating' | 'publishing' | 'complete' | 'failed';

@Entity('extraction_jobs')
export class ExtractionJob {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 40, default: 'queued' }) status: ExtractionJobStatus;
  @Column('simple-json') sourceRefs: string[];
  @Column({ type: 'int', default: 0 }) currentIndex: number;
  @Column({ type: 'int', default: 0 }) totalSources: number;
  @Column({ type: 'int', default: 0 }) processedCandidates: number;
  @Column({ type: 'int', default: 0 }) publishedCount: number;
  @Column({ type: 'int', default: 0 }) duplicateCount: number;
  @Column({ type: 'int', default: 0 }) failedCount: number;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
