import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { AuthSubjectType } from '../auth.types';

@Entity('auth_sessions')
@Index('UQ_auth_sessions_token_hash', ['tokenHash'], { unique: true })
@Index('IDX_auth_sessions_subject', ['subjectType', 'subjectId', 'expiresAt'])
export class AuthSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10 })
  subjectType: AuthSubjectType;

  @Column({ type: 'varchar', length: 64 })
  subjectId: string;

  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  csrfHash: string | null;

  @Column({ type: 'varchar', length: 32 })
  expiresAt: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  revokedAt: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
