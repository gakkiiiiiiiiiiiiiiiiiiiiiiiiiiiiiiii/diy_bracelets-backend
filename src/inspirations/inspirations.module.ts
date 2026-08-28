import { Module } from '@nestjs/common';
import { BraceletCodeModule } from '../bracelet-code/bracelet-code.module';
import { DesignsModule } from '../designs/designs.module';
import { MaterialsModule } from '../materials/materials.module';
import { AdminInspirationsController, InspirationsController } from './inspirations.controller';
import { InspirationsService } from './inspirations.service';

@Module({
  imports: [DesignsModule, MaterialsModule, BraceletCodeModule],
  controllers: [InspirationsController, AdminInspirationsController],
  providers: [InspirationsService],
})
export class InspirationsModule {}
