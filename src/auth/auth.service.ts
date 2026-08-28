import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { IsNull, LessThan, Repository } from 'typeorm';
import type { AuthSubjectType } from './auth.types';
import { AuthSession } from './entities/auth-session.entity';
import { User } from './entities/user.entity';
import { verifyAdminPassword } from './password-hash';

interface CreatedSession {
  session: AuthSession;
  token: string;
  csrfToken: string | null;
}

interface WechatSessionResponse {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(AuthSession)
    private readonly sessions: Repository<AuthSession>,
    private readonly config: ConfigService,
  ) {}

  async loginAdmin(username: string, password: string): Promise<{
    username: string;
    token: string;
    csrfToken: string;
    expiresAt: string;
  }> {
    const configuredUsername = this.config.get<string>('ADMIN_USERNAME', '');
    const configuredHash = this.config.get<string>('ADMIN_PASSWORD_HASH', '');
    const usernameMatches = this.safeEqual(username, configuredUsername);
    const passwordMatches = configuredHash
      ? verifyAdminPassword(password, configuredHash)
      : false;
    if (!usernameMatches || !passwordMatches) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    await this.removeExpiredSessions();
    const created = await this.createSession(
      'admin',
      configuredUsername,
      this.config.get<number>('ADMIN_SESSION_TTL_SECONDS', 8 * 60 * 60),
      true,
    );
    return {
      username: configuredUsername,
      token: created.token,
      csrfToken: created.csrfToken!,
      expiresAt: created.session.expiresAt,
    };
  }

  async loginWechat(code: string): Promise<{
    accessToken: string;
    expiresAt: string;
    user: { id: string; displayName: string; avatarUrl: string | null };
  }> {
    const appId = this.config.get<string>('WECHAT_APP_ID', '');
    const appSecret = this.config.get<string>('WECHAT_APP_SECRET', '');
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException('微信登录尚未配置');
    }

    const endpoint = new URL('https://api.weixin.qq.com/sns/jscode2session');
    endpoint.searchParams.set('appid', appId);
    endpoint.searchParams.set('secret', appSecret);
    endpoint.searchParams.set('js_code', code);
    endpoint.searchParams.set('grant_type', 'authorization_code');

    let payload: WechatSessionResponse;
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = await response.json() as WechatSessionResponse;
    } catch {
      throw new ServiceUnavailableException('微信登录服务暂时不可用');
    }
    if (payload.errcode || !payload.openid) {
      throw new UnauthorizedException('微信登录凭证无效或已过期');
    }

    const externalIdHash = this.hashToken(payload.openid);
    const now = new Date().toISOString();
    let user = await this.users.findOne({
      where: { provider: 'wechat', externalIdHash },
    });
    if (!user) {
      await this.users.createQueryBuilder()
        .insert()
        .values({
          provider: 'wechat',
          externalIdHash,
          displayName: '',
          avatarUrl: null,
          lastLoginAt: now,
        })
        .orIgnore()
        .execute();
      user = await this.users.findOne({
        where: { provider: 'wechat', externalIdHash },
      });
    }
    if (!user) throw new ServiceUnavailableException('无法创建用户登录状态');
    user.lastLoginAt = now;
    user = await this.users.save(user);

    await this.removeExpiredSessions();
    const created = await this.createSession(
      'user',
      user.id,
      this.config.get<number>('USER_SESSION_TTL_SECONDS', 30 * 24 * 60 * 60),
      false,
    );
    return {
      accessToken: created.token,
      expiresAt: created.session.expiresAt,
      user: { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl },
    };
  }

  async authenticate(
    rawToken: string,
    subjectType: AuthSubjectType,
  ): Promise<AuthSession | null> {
    if (!/^[A-Za-z0-9_-]{40,128}$/.test(rawToken)) return null;
    const session = await this.sessions.findOne({
      where: {
        tokenHash: this.hashToken(rawToken),
        subjectType,
        revokedAt: IsNull(),
      },
    });
    if (!session) return null;
    if (session.expiresAt <= new Date().toISOString()) {
      session.revokedAt = new Date().toISOString();
      await this.sessions.save(session);
      return null;
    }
    return session;
  }

  async revokeSession(id: string): Promise<void> {
    await this.sessions.update(id, { revokedAt: new Date().toISOString() });
  }

  verifyCsrf(session: AuthSession, token: string): boolean {
    if (!session.csrfHash || !token) return false;
    const actual = Buffer.from(this.hashToken(token), 'hex');
    const expected = Buffer.from(session.csrfHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private async createSession(
    subjectType: AuthSubjectType,
    subjectId: string,
    ttlSeconds: number,
    withCsrf: boolean,
  ): Promise<CreatedSession> {
    const token = randomBytes(32).toString('base64url');
    const csrfToken = withCsrf ? randomBytes(24).toString('base64url') : null;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1_000).toISOString();
    const session = await this.sessions.save(this.sessions.create({
      subjectType,
      subjectId,
      tokenHash: this.hashToken(token),
      csrfHash: csrfToken ? this.hashToken(csrfToken) : null,
      expiresAt,
      revokedAt: null,
    }));
    return { session, token, csrfToken };
  }

  private async removeExpiredSessions(): Promise<void> {
    await this.sessions.delete({ expiresAt: LessThan(new Date().toISOString()) });
  }

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private safeEqual(actual: string, expected: string): boolean {
    const actualHash = Buffer.from(this.hashToken(actual), 'hex');
    const expectedHash = Buffer.from(this.hashToken(expected), 'hex');
    return timingSafeEqual(actualHash, expectedHash);
  }
}
