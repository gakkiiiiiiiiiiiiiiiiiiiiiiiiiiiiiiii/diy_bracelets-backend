import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { CreateExtractionJobDto } from './dto/create-extraction-job.dto';
import { ExtractionService } from './extraction.service';
import { Access } from '../auth/access.decorator';

const extractionStorage = diskStorage({
  destination: (_req, _file, callback) => {
    const uploadRoot = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    const extractionSourceDir = join(uploadRoot, 'extraction-sources');
    mkdirSync(extractionSourceDir, { recursive: true });
    callback(null, extractionSourceDir);
  },
  filename: (_req, file, callback) => {
    const extension = extname(file.originalname).toLowerCase() || (file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : '.jpg');
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  },
});

@Access('admin')
@Controller('api/admin')
export class ExtractionController {
  constructor(private readonly service: ExtractionService) {}

  @Post('extraction-images')
  @UseInterceptors(FilesInterceptor('files', 30, {
    storage: extractionStorage,
    limits: { fileSize: 20 * 1024 * 1024, files: 30 },
    fileFilter: (_req, file, callback) => {
      const allowed = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype) && /\.(png|jpe?g|webp)$/i.test(file.originalname);
      callback(allowed ? null : new BadRequestException('只支持 PNG、JPG 和 WebP 图片'), allowed);
    },
  }))
  uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('请至少上传一张手串图片');
    return files.map((file) => {
      const path = `/uploads/extraction-sources/${file.filename}`;
      return { name: file.originalname, url: path, path, size: file.size };
    });
  }

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
