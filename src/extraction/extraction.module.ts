import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../categories/categories.module';
import { MaterialsModule } from '../materials/materials.module';
import { ExtractionController } from './extraction.controller';
import { ExtractionService } from './extraction.service';
import { ExtractionJob } from './entities/extraction-job.entity';
import { ExtractionResult } from './entities/extraction-result.entity';
import { ExtractionEnabledGuard } from './extraction-enabled.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ExtractionJob, ExtractionResult]), MaterialsModule, CategoriesModule],
  controllers: [ExtractionController],
  providers: [ExtractionService, ExtractionEnabledGuard],
})
export class ExtractionModule {}
