import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { CreateExtractionJobDto } from './dto/create-extraction-job.dto';
import { ExtractionService } from './extraction.service';

@Controller('api/admin')
export class ExtractionController {
  constructor(private readonly service: ExtractionService) {}

  @Post('extraction-jobs') create(@Body() dto: CreateExtractionJobDto) { return this.service.create(dto); }

  @Get('extraction-jobs/:id')
  async findOne(@Param('id') id: string) {
    const job = await this.service.findOne(id);
    if (!job) throw new NotFoundException('提取任务不存在');
    return job;
  }

  @Get('extraction-results') list(@Query('jobId') jobId?: string) { return this.service.listResults(jobId); }
  @Post('extraction-results/:id/retry') retry(@Param('id') id: string) { return this.service.retry(id); }
}
