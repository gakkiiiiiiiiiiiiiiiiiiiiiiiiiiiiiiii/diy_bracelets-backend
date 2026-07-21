import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BraceletAgentModule } from '../bracelet-agent/bracelet-agent.module';
import { MaterialsModule } from '../materials/materials.module';
import { DesignProcessVideosController } from './design-process-videos.controller';
import { DesignProcessVideosService } from './design-process-videos.service';
import { DesignProcessVideo } from './entities/design-process-video.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DesignProcessVideo]), MaterialsModule, BraceletAgentModule],
  controllers: [DesignProcessVideosController],
  providers: [DesignProcessVideosService],
})
export class DesignProcessVideosModule {}
