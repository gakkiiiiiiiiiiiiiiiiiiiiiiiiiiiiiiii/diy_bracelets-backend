import { Module } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CategoriesModule } from './categories/categories.module';
import { MaterialsModule } from './materials/materials.module';
import { DesignsModule } from './designs/designs.module';
import { HomeModule } from './home/home.module';
import { GoodsModule } from './goods/goods.module';
import { CartModule } from './cart/cart.module';
import { ProfileModule } from './profile/profile.module';
import { MyDesignsModule } from './my-designs/my-designs.module';
import { ContentModule } from './content/content.module';
import { AiModule } from './ai/ai.module';
import { ExtractionModule } from './extraction/extraction.module';
import { BraceletCodeModule } from './bracelet-code/bracelet-code.module';
import { BraceletAgentModule } from './bracelet-agent/bracelet-agent.module';
import { InspirationsModule } from './inspirations/inspirations.module';
import { DesignProcessVideosModule } from './design-process-videos/design-process-videos.module';
import { validateEnvironment } from './config/environment';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { SessionAuthGuard } from './auth/session-auth.guard';
import { AddressesModule } from './addresses/addresses.module';
import { OrdersModule } from './orders/orders.module';

const migrations = [__dirname + '/database/migrations/*{.ts,.js}'];

function getPostgresSsl(config: ConfigService): false | { rejectUnauthorized: boolean; ca?: string } {
  const mode = config.get<string>('DB_SSL_MODE', 'disable');
  if (mode === 'disable') return false;
  if (mode === 'require') return { rejectUnauthorized: false };
  const inlineCa = config.get<string>('DB_SSL_CA', '').replace(/\\n/g, '\n').trim();
  if (inlineCa) return { rejectUnauthorized: true, ca: inlineCa };
  const caPath = config.get<string>('DB_SSL_CA_PATH', '');
  return { rejectUnauthorized: true, ca: readFileSync(caPath, 'utf8') };
}

function getDatabaseConfig(config: ConfigService): TypeOrmModuleOptions {
  const hasRemoteConfig = Boolean(config.get<string>('REMOTE_DB_HOST'));
  const hasDbHost = Boolean(config.get<string>('DB_HOST'));
  const databasePath = config.get<string>('DATABASE_PATH');
  if (!hasDbHost && !hasRemoteConfig && databasePath) {
    return {
      type: 'sqlite',
      database: databasePath,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      migrations,
      migrationsRun: config.get('NODE_ENV') === 'production',
      migrationsTableName: 'app_migrations',
      synchronize: config.get('NODE_ENV') !== 'production',
      logging: config.get('NODE_ENV') === 'development',
      retryAttempts: config.get<number>('DB_CONNECT_RETRIES', 10),
      retryDelay: config.get<number>('DB_CONNECT_RETRY_DELAY_MS', 3_000),
    };
  }

  const type = config.get<'postgres' | 'mysql'>(
    'DB_TYPE',
    config.get<'postgres' | 'mysql'>('REMOTE_DB_TYPE', hasRemoteConfig ? 'mysql' : 'postgres'),
  );
  const host = config.get<string>('DB_HOST', config.get<string>('REMOTE_DB_HOST', 'localhost'));
  const port = Number(
    config.get<string | number>('DB_PORT', config.get<string | number>('REMOTE_DB_PORT', type === 'mysql' ? 3306 : 5432)),
  );
  const username = config.get<string>('DB_USERNAME', config.get<string>('REMOTE_DB_USERNAME', type === 'mysql' ? 'root' : 'postgres'));
  const password = config.get<string>('DB_PASSWORD', config.get<string>('REMOTE_DB_PASSWORD', type === 'mysql' ? '' : 'postgres'));
  const database = config.get<string>('DB_DATABASE', config.get<string>('REMOTE_DB_DATABASE', 'diy_bracelets'));
  const poolMax = config.get<number>('DB_POOL_MAX', 10);
  const connectionTimeout = config.get<number>('DB_CONNECTION_TIMEOUT_MS', 5_000);
  const statementTimeout = config.get<number>('DB_STATEMENT_TIMEOUT_MS', 15_000);

  return {
    type,
    host,
    port,
    username,
    password,
    database,
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    migrations,
    migrationsRun: config.get('NODE_ENV') === 'production',
    migrationsTableName: 'app_migrations',
    synchronize: config.get('NODE_ENV') !== 'production',
    logging: config.get('NODE_ENV') === 'development',
    charset: type === 'mysql' ? 'utf8mb4' : undefined,
    ssl: type === 'postgres' ? getPostgresSsl(config) : undefined,
    extra: type === 'postgres'
      ? {
          max: poolMax,
          connectionTimeoutMillis: connectionTimeout,
          statement_timeout: statementTimeout,
          idle_in_transaction_session_timeout: statementTimeout,
        }
      : { connectionLimit: poolMax, connectTimeout: connectionTimeout },
    retryAttempts: config.get<number>('DB_CONNECT_RETRIES', 10),
    retryDelay: config.get<number>('DB_CONNECT_RETRY_DELAY_MS', 3_000),
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [{
        ttl: config.get<number>('RATE_LIMIT_TTL_MS', 60_000),
        limit: config.get<number>('RATE_LIMIT_MAX', 120),
      }],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    AuthModule,
    AddressesModule,
    CategoriesModule,
    MaterialsModule,
    DesignsModule,
    HomeModule,
    GoodsModule,
    CartModule,
    OrdersModule,
    ProfileModule,
    MyDesignsModule,
    ContentModule,
    AiModule,
    ExtractionModule,
    BraceletCodeModule,
    BraceletAgentModule,
    InspirationsModule,
    DesignProcessVideosModule,
    HealthModule,
  ],
  providers: [
    Logger,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
  ],
})
export class AppModule {}
