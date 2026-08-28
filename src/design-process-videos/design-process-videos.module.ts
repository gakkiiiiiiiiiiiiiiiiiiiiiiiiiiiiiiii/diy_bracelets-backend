import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DesignProcessVideosController } from './design-process-videos.controller';
import { DesignProcessVideosService } from './design-process-videos.service';
import { DesignProcessVideo } from './entities/design-process-video.entity';
import { MaterialsModule } from '../materials/materials.module';

@Module({
  imports: [TypeOrmModule.forFeature([DesignProcessVideo]), MaterialsModule],
  controllers: [DesignProcessVideosController],
  providers: [DesignProcessVideosService],
})
export class DesignProcessVideosModule {}
