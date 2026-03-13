import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Design } from './entities/design.entity';
import { DesignsService } from './designs.service';
import { DesignsController } from './designs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Design])],
  controllers: [DesignsController],
  providers: [DesignsService],
  exports: [DesignsService],
})
export class DesignsModule {}
