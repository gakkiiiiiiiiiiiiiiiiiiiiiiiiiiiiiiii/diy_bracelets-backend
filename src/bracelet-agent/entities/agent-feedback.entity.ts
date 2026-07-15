import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('agent_feedback')
export class AgentFeedback {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() generationId: string;
  @Column({ type: 'varchar', length: 20 }) action: 'accepted' | 'modified' | 'rejected';
  @Column({ type: 'int', nullable: true }) candidateIndex: number | null;
  @Column('simple-json', { nullable: true }) finalBeads: Array<{ materialId: string; specId: string }> | null;
  @Column({ type: 'text', default: '' }) note: string;
  @CreateDateColumn() createdAt: Date;
}
