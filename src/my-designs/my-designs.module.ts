import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedDesign } from './entities/saved-design.entity';
import { MyDesignsService } from './my-designs.service';
import { MyDesignsController } from './my-designs.controller';
import { MaterialsModule } from '../materials/materials.module';

@Module({
  imports: [TypeOrmModule.forFeature([SavedDesign]), MaterialsModule],
  controllers: [MyDesignsController],
  providers: [MyDesignsService],
  exports: [MyDesignsService],
})
export class MyDesignsModule {}
