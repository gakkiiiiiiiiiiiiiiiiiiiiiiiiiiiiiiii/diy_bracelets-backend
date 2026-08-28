import type { Request } from 'express';

export type AuthSubjectType = 'user' | 'admin';
export type AuthTokenSource = 'bearer' | 'cookie';

export interface AuthPrincipal {
  sessionId: string;
  subjectType: AuthSubjectType;
  subjectId: string;
  expiresAt: string;
  tokenSource: AuthTokenSource;
}

export type AuthenticatedRequest = Request & { auth: AuthPrincipal };
