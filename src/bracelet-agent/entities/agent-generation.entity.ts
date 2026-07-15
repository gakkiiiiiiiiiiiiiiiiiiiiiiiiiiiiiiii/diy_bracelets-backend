import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('agent_generations')
export class AgentGeneration {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 20, default: 'queued' }) status: 'queued' | 'analyzing' | 'retrieving' | 'generating' | 'rendering' | 'complete' | 'failed';
  @Column('simple-json') input: { colors: string[]; referenceImage?: string; wristCm: number };
  @Column('simple-json', { nullable: true }) candidates: unknown[] | null;
  @Column({ type: 'text', nullable: true }) referenceDescription: string | null;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
