import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import express from 'express';
import { AppModule } from './app.module';

const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use('/uploads', express.static(uploadDir));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  // 跨域：允许前端/管理端开发域名；生产环境建议配置具体 origin 列表
  app.enableCors({
    origin: true, // 开发环境允许任意 origin；生产可改为 ['https://你的域名']
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = Number(process.env.PORT) || 3008;
  await app.listen(port, '0.0.0.0');
  console.log(`diy-bracelets-api listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
