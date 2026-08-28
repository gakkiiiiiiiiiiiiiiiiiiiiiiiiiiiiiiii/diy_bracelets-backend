import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

const storage = diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const extension = extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${randomUUID()}${extension}`);
  },
});

const allowedImageTypes = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
]);

@Controller('api/materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  findAll() {
    return this.materialsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.materialsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateMaterialDto) {
    return this.materialsService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateMaterialDto) {
    return this.materialsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.materialsService.remove(id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const extension = extname(file.originalname).toLowerCase();
        if (allowedImageTypes.get(extension) !== file.mimetype) {
          return cb(new BadRequestException('只允许图片格式'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('未上传文件');
    const publicPath = `/uploads/${file.filename}`;
    return { url: publicPath, path: publicPath };
  }
}
