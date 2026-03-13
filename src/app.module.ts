import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CategoriesModule } from './categories/categories.module';
import { MaterialsModule } from './materials/materials.module';
import { DesignsModule } from './designs/designs.module';
import { HomeModule } from './home/home.module';
import { GoodsModule } from './goods/goods.module';
import { CartModule } from './cart/cart.module';
import { ProfileModule } from './profile/profile.module';
import { MyDesignsModule } from './my-designs/my-designs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_DATABASE', 'diy_bracelets'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
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
  ],
})
export class AppModule {}
