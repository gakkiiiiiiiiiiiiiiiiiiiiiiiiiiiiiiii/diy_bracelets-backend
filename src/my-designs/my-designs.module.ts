import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedDesign } from './entities/saved-design.entity';
import { MyDesignsService } from './my-designs.service';
import { MyDesignsController } from './my-designs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SavedDesign])],
  controllers: [MyDesignsController],
  providers: [MyDesignsService],
  exports: [MyDesignsService],
})
export class MyDesignsModule {}
