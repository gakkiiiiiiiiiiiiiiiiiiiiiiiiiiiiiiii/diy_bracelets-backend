import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BraceletCodeModule } from '../bracelet-code/bracelet-code.module';
import { MaterialsModule } from '../materials/materials.module';
import { BraceletAgentController } from './bracelet-agent.controller';
import { BraceletAgentService } from './bracelet-agent.service';
import { BraceletRenderService } from './bracelet-render.service';
import { AgentFeedback } from './entities/agent-feedback.entity';
import { AgentGeneration } from './entities/agent-generation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AgentGeneration, AgentFeedback]), MaterialsModule, BraceletCodeModule],
  controllers: [BraceletAgentController], providers: [BraceletAgentService, BraceletRenderService],
  exports: [BraceletRenderService],
})
export class BraceletAgentModule {}
