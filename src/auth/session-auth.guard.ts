import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ACCESS_LEVEL_KEY, AccessLevel } from './access.decorator';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest, AuthSubjectType, AuthTokenSource } from './auth.types';

const ADMIN_COOKIE_NAME = 'diy_admin_session';
const PRODUCTION_ADMIN_COOKIE_NAME = '__Host-diy_admin_session';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access = this.reflector.getAllAndOverride<AccessLevel>(ACCESS_LEVEL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? 'admin';
    if (access === 'public') return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const subjectType: AuthSubjectType = access;
    const credential = subjectType === 'admin'
      ? this.extractAdminToken(request)
      : this.extractBearerToken(request);
    if (!credential) throw new UnauthorizedException('请先登录');

    const session = await this.auth.authenticate(credential.token, subjectType);
    if (!session) throw new UnauthorizedException('登录状态无效或已过期');

    if (
      subjectType === 'admin' &&
      credential.source === 'cookie' &&
      !SAFE_METHODS.has(request.method.toUpperCase())
    ) {
      const csrfToken = request.header('X-CSRF-Token') ?? '';
      if (!this.auth.verifyCsrf(session, csrfToken)) {
        throw new ForbiddenException('CSRF 校验失败');
      }
    }

    request.auth = {
      sessionId: session.id,
      subjectType,
      subjectId: session.subjectId,
      expiresAt: session.expiresAt,
      tokenSource: credential.source,
    };
    return true;
  }

  private extractAdminToken(request: Request): { token: string; source: AuthTokenSource } | null {
    const bearer = this.extractBearerToken(request);
    if (bearer) return bearer;
    const cookies = this.parseCookies(request.header('cookie') ?? '');
    const cookie = cookies[PRODUCTION_ADMIN_COOKIE_NAME] ?? cookies[ADMIN_COOKIE_NAME];
    return cookie ? { token: cookie, source: 'cookie' } : null;
  }

  private extractBearerToken(request: Request): { token: string; source: 'bearer' } | null {
    const authorization = request.header('authorization') ?? '';
    const match = /^Bearer\s+([A-Za-z0-9_-]{40,128})$/i.exec(authorization);
    return match ? { token: match[1], source: 'bearer' } : null;
  }

  private parseCookies(value: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    for (const part of value.split(';')) {
      const separator = part.indexOf('=');
      if (separator <= 0) continue;
      const key = part.slice(0, separator).trim();
      const rawValue = part.slice(separator + 1).trim();
      try {
        cookies[key] = decodeURIComponent(rawValue);
      } catch {
        // Ignore malformed cookies rather than failing unrelated requests.
      }
    }
    return cookies;
  }
}
