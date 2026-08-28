import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { constants, accessSync } from 'fs';
import { join, resolve } from 'path';

@Injectable()
export class StorageHealthIndicator extends HealthIndicator {
  private readonly uploadDir: string;

  constructor(config: ConfigService) {
    super();
    this.uploadDir = resolve(config.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads')));
  }

  check(key: string): HealthIndicatorResult {
    try {
      accessSync(this.uploadDir, constants.R_OK | constants.W_OK);
      return this.getStatus(key, true, { path: this.uploadDir });
    } catch {
      throw new HealthCheckError(
        'Upload storage is unavailable',
        this.getStatus(key, false, { path: this.uploadDir }),
      );
    }
  }
}
