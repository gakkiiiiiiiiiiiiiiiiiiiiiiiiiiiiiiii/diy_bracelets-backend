import { ForbiddenException, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { parseBoolean, parseCorsOrigins, parseTrustProxy } from './config/environment';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const uploadDir = config.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads'));
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

  app.useLogger(app.get(Logger));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use((request: Request, response: Response, next: NextFunction) => {
    const provided = request.header('X-Request-Id');
    const requestId = provided && /^[A-Za-z0-9._:-]{1,128}$/.test(provided) ? provided : randomUUID();
    response.setHeader('X-Request-Id', requestId);
    next();
  });
  app.use('/uploads', express.static(uploadDir, {
    dotfiles: 'deny',
    index: false,
    maxAge: '1d',
    setHeaders: (response) => response.setHeader('X-Content-Type-Options', 'nosniff'),
  }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const allowedOrigins = parseCorsOrigins(config.get<string>('CORS_ORIGINS', ''));
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || !isProduction || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
        callback(null, true);
        return;
      }
      callback(new ForbiddenException('Origin is not allowed by CORS'), false);
    },
    credentials: parseBoolean(config.get('CORS_ALLOW_CREDENTIALS'), false),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-HTTP-Method-Override',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
  });

  const trustProxy = parseTrustProxy(config.get('TRUST_PROXY'));
  if (trustProxy !== false) app.set('trust proxy', trustProxy);
  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3008);
  await app.listen(port, '0.0.0.0');
  logger.log(`diy-bracelets-api listening on port ${port}`);
}

bootstrap().catch((err) => {
  new Logger('Bootstrap').error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
