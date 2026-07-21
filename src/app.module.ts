import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
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

function getDatabaseConfig(config: ConfigService): TypeOrmModuleOptions {
  const hasRemoteConfig = Boolean(config.get<string>('REMOTE_DB_HOST'));
  const hasDbHost = Boolean(config.get<string>('DB_HOST'));
  const databasePath = config.get<string>('DATABASE_PATH');
  if (!hasDbHost && !hasRemoteConfig && databasePath) {
    return {
      type: 'sqlite',
      database: databasePath,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: config.get('NODE_ENV') !== 'production',
      logging: config.get('NODE_ENV') === 'development',
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

  return {
    type,
    host,
    port,
    username,
    password,
    database,
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    synchronize: config.get('NODE_ENV') !== 'production',
    logging: config.get('NODE_ENV') === 'development',
    charset: type === 'mysql' ? 'utf8mb4' : undefined,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    CategoriesModule,
    MaterialsModule,
    DesignsModule,
    HomeModule,
    GoodsModule,
    CartModule,
    ProfileModule,
    MyDesignsModule,
    ContentModule,
    AiModule,
    ExtractionModule,
    BraceletCodeModule,
    BraceletAgentModule,
    InspirationsModule,
    DesignProcessVideosModule,
  ],
})
export class AppModule {}
