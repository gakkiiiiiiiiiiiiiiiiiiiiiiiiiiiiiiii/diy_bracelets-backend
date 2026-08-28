import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Access } from './access.decorator';
import { AuthService } from './auth.service';
import { CurrentAuth } from './current-auth.decorator';
import { AdminLoginDto, WechatLoginDto } from './dto/auth.dto';
import type { AuthPrincipal } from './auth.types';
import { parseBoolean } from '../config/environment';

const ADMIN_COOKIE_NAME = 'diy_admin_session';
const PRODUCTION_ADMIN_COOKIE_NAME = '__Host-diy_admin_session';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Access('public')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('wechat')
  loginWechat(@Body() dto: WechatLoginDto) {
    return this.auth.loginWechat(dto.code);
  }

  @Access('user')
  @Get('me')
  me(@CurrentAuth() principal: AuthPrincipal) {
    return { userId: principal.subjectId, expiresAt: principal.expiresAt };
  }

  @Access('user')
  @HttpCode(204)
  @Post('logout')
  async logout(@CurrentAuth() principal: AuthPrincipal) {
    await this.auth.revokeSession(principal.sessionId);
  }
}

@Controller('api/admin/auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Access('public')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.loginAdmin(dto.username, dto.password);
    response.cookie(this.cookieName(), result.token, this.cookieOptions());
    return {
      username: result.username,
      csrfToken: result.csrfToken,
      expiresAt: result.expiresAt,
    };
  }

  @Access('admin')
  @Get('session')
  session(@CurrentAuth() principal: AuthPrincipal) {
    return { username: principal.subjectId, expiresAt: principal.expiresAt };
  }

  @Access('admin')
  @HttpCode(204)
  @Post('logout')
  async logout(
    @CurrentAuth() principal: AuthPrincipal,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.revokeSession(principal.sessionId);
    const { maxAge: _maxAge, ...clearOptions } = this.cookieOptions();
    response.clearCookie(this.cookieName(), clearOptions);
  }

  private cookieOptions() {
    const production = this.config.get<string>('NODE_ENV') === 'production';
    const maxAge = this.config.get<number>('ADMIN_SESSION_TTL_SECONDS', 8 * 60 * 60) * 1_000;
    return {
      httpOnly: true,
      secure: parseBoolean(this.config.get('ADMIN_COOKIE_SECURE'), production),
      sameSite: this.config.get<'strict' | 'lax' | 'none'>('ADMIN_COOKIE_SAME_SITE', 'strict'),
      path: '/',
      maxAge,
    } as const;
  }

  private cookieName(): string {
    return this.config.get<string>('NODE_ENV') === 'production'
      ? PRODUCTION_ADMIN_COOKIE_NAME
      : ADMIN_COOKIE_NAME;
  }
}
