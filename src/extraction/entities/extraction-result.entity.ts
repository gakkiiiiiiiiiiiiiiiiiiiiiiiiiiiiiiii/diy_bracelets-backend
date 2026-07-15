import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CrystalCandidate } from '../../ai/ai.types';

export type ExtractionResultStatus = 'detected' | 'duplicate' | 'merged' | 'published' | 'failed';

@Entity('extraction_results')
export class ExtractionResult {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() jobId: string;
  @Column() sourceRef: string;
  @Column({ type: 'int', default: 0 }) candidateIndex: number;
  @Column({ type: 'varchar', length: 20, default: 'detected' }) status: ExtractionResultStatus;
  @Column('simple-json') detection: CrystalCandidate;
  @Column({ default: '' }) sourceHash: string;
  @Column({ default: '' }) sourceCrop: string;
  @Column({ default: '' }) perceptualHash: string;
  @Column('simple-json', { nullable: true }) embedding: number[] | null;
  @Column({ type: 'text', default: '' }) prompt: string;
  @Column({ type: 'varchar', length: 10, default: 'green' }) keyColor: 'green' | 'magenta';
  @Column({ default: '' }) keyImage: string;
  @Column({ default: '' }) image: string;
  @Column({ type: 'varchar', nullable: true }) materialId: string | null;
  @Column({ type: 'varchar', nullable: true }) duplicateOf: string | null;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @Column({ type: 'int', default: 0 }) attempts: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
