import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { StorageHealthIndicator } from './storage.health';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly storage: StorageHealthIndicator,
  ) {}

  @Get('live')
  live() {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.database.pingCheck('database', { timeout: 2_000 }),
      () => Promise.resolve(this.storage.check('storage')),
    ]);
  }
}
