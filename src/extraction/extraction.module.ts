import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../categories/categories.module';
import { MaterialsModule } from '../materials/materials.module';
import { ExtractionController } from './extraction.controller';
import { ExtractionService } from './extraction.service';
import { ExtractionJob } from './entities/extraction-job.entity';
import { ExtractionResult } from './entities/extraction-result.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ExtractionJob, ExtractionResult]), MaterialsModule, CategoriesModule],
  controllers: [ExtractionController],
  providers: [ExtractionService],
})
export class ExtractionModule {}
