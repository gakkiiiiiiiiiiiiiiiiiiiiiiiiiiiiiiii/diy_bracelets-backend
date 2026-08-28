import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { extname, isAbsolute, join, relative, resolve } from 'path';
import sharp, { Metadata } from 'sharp';

export interface LoadedImage {
  buffer: Buffer;
  mime: string;
  sourceRef: string;
}

@Injectable()
export class ImageAssetsService {
  readonly uploadDir: string;
  readonly extractionSourceDir: string;
  readonly extractionOutputDir: string;
  private readonly frontendStaticDir: string;
  private readonly maxImageBytes = 20 * 1024 * 1024;
  private readonly maxImagePixels = 40_000_000;

  constructor(config: ConfigService) {
    this.uploadDir = resolve(config.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads')));
    this.extractionSourceDir = resolve(config.get<string>('EXTRACTION_SOURCE_DIR', join(process.cwd(), '..', 'downloads', 'douyin-wufang-bracelets', 'carousel-originals')));
    this.extractionOutputDir = resolve(config.get<string>('EXTRACTION_OUTPUT_DIR', join(this.uploadDir, 'extractions')));
    this.frontendStaticDir = resolve(config.get<string>('FRONTEND_STATIC_DIR', join(process.cwd(), '..', 'frontend', 'src', 'static')));
    for (const dir of [this.uploadDir, this.extractionOutputDir]) if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  listDefaultSources(): string[] {
    if (!existsSync(this.extractionSourceDir)) return [];
    return readdirSync(this.extractionSourceDir)
      .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
      .sort()
      .map((name) => join(this.extractionSourceDir, name));
  }

  private isInside(path: string, root: string): boolean {
    const rel = relative(root, path);
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  }

  private localPath(sourceRef: string): string {
    if (sourceRef.startsWith('/uploads/')) {
      const path = resolve(this.uploadDir, sourceRef.slice('/uploads/'.length));
      if (!this.isInside(path, this.uploadDir)) throw new BadRequestException('图片路径不在允许目录内');
      return path;
    }
    if (sourceRef.startsWith('/static/')) {
      const path = resolve(this.frontendStaticDir, sourceRef.slice('/static/'.length));
      if (!this.isInside(path, this.frontendStaticDir)) throw new BadRequestException('图片路径不在允许目录内');
      return path;
    }
    const path = resolve(isAbsolute(sourceRef) ? sourceRef : join(process.cwd(), sourceRef));
    if (![this.extractionSourceDir, this.uploadDir, this.frontendStaticDir].some((root) => this.isInside(path, root))) {
      throw new BadRequestException('图片路径不在允许目录内');
    }
    return path;
  }

  async load(sourceRef: string): Promise<LoadedImage> {
    if (/^https?:\/\//i.test(sourceRef)) {
      throw new BadRequestException('不支持直接读取远程图片，请先通过后台上传');
    }
    const path = this.localPath(sourceRef);
    if (!existsSync(path)) throw new BadRequestException(`图片不存在: ${sourceRef}`);
    const stat = statSync(path);
    if (!stat.isFile()) throw new BadRequestException('图片路径不是文件');
    if (stat.size > this.maxImageBytes) throw new BadRequestException('图片超过20MB');
    const buffer = readFileSync(path);
    let metadata: Metadata;
    try {
      metadata = await sharp(buffer, { limitInputPixels: this.maxImagePixels }).metadata();
    } catch {
      throw new BadRequestException('图片内容无效或像素尺寸过大');
    }
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > this.maxImagePixels) {
      throw new BadRequestException('图片像素尺寸过大');
    }
    if ((metadata.pages ?? 1) > 1) throw new BadRequestException('不支持动画图片');
    const mimeByFormat: Record<string, string> = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    const mime = metadata.format ? mimeByFormat[metadata.format] : undefined;
    if (!mime) throw new BadRequestException('只支持 PNG、JPG 和 WebP 图片');
    return { buffer, mime, sourceRef };
  }

  sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  async representativeCrop(buffer: Buffer, bbox: { x: number; y: number; width: number; height: number }): Promise<Buffer> {
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 1;
    const height = metadata.height || 1;
    const left = Math.max(0, Math.min(width - 1, Math.floor(Math.max(0, bbox.x) * width)));
    const top = Math.max(0, Math.min(height - 1, Math.floor(Math.max(0, bbox.y) * height)));
    const cropWidth = Math.max(1, Math.min(width - left, Math.ceil(Math.max(0.02, bbox.width) * width)));
    const cropHeight = Math.max(1, Math.min(height - top, Math.ceil(Math.max(0.02, bbox.height) * height)));
    return sharp(buffer).extract({ left, top, width: cropWidth, height: cropHeight }).png().toBuffer();
  }

  async perceptualHash(buffer: Buffer): Promise<string> {
    const { data } = await sharp(buffer).resize(9, 8, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
    let bits = '';
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? '1' : '0';
    }
    return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
  }

  hammingDistance(a?: string | null, b?: string | null): number {
    if (!a || !b || a.length !== b.length) return Number.MAX_SAFE_INTEGER;
    let distance = 0;
    for (let i = 0; i < a.length; i += 1) {
      let value = parseInt(a[i], 16) ^ parseInt(b[i], 16);
      while (value) { distance += value & 1; value >>= 1; }
    }
    return distance;
  }

  cosineSimilarity(a?: number[] | null, b?: number[] | null): number {
    if (!a?.length || !b?.length || a.length !== b.length) return 0;
    let dot = 0; let aa = 0; let bb = 0;
    for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
    return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
  }

  async removeChromaKey(buffer: Buffer, key: 'green' | 'magenta'): Promise<Buffer> {
    const { data, info } = await sharp(buffer)
      .resize(1024, 1024, { fit: 'contain', background: key === 'green' ? '#00ff00' : '#ff00ff' })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const target = key === 'green' ? [0, 255, 0] : [255, 0, 255];
    for (let i = 0; i < data.length; i += 4) {
      const distance = Math.sqrt((data[i] - target[0]) ** 2 + (data[i + 1] - target[1]) ** 2 + (data[i + 2] - target[2]) ** 2);
      const alpha = distance <= 12 ? 0 : distance >= 220 ? 255 : Math.round(((distance - 12) / 208) * 255);
      data[i + 3] = Math.min(data[i + 3], alpha);
      if (alpha < 255 && alpha > 0) {
        if (key === 'green') data[i + 1] = Math.min(data[i + 1], Math.max(data[i], data[i + 2]));
        else { const rb = Math.min(data[i], data[i + 2], data[i + 1]); data[i] = Math.min(data[i], rb + 24); data[i + 2] = Math.min(data[i + 2], rb + 24); }
      }
    }
    return sharp(data, { raw: info }).png().toBuffer();
  }

  async validateTransparentBead(buffer: Buffer): Promise<{ valid: boolean; reasons: string[]; coverage: number }> {
    const metadata = await sharp(buffer).metadata();
    const reasons: string[] = [];
    if (metadata.width !== 1024 || metadata.height !== 1024) reasons.push('尺寸不是1024×1024');
    if (!metadata.hasAlpha) reasons.push('缺少Alpha通道');
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 24) opaque += 1;
    const coverage = opaque / (info.width * info.height);
    if (coverage < 0.08 || coverage > 0.72) reasons.push('主体覆盖率异常');
    const corners = [[0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1]];
    if (corners.some(([x, y]) => data[(y * info.width + x) * 4 + 3] > 12)) reasons.push('四角未透明');
    return { valid: reasons.length === 0, reasons, coverage };
  }

  save(jobId: string, name: string, buffer: Buffer): { absolutePath: string; publicPath: string } {
    const dir = join(this.extractionOutputDir, jobId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const absolutePath = join(dir, safeName);
    writeFileSync(absolutePath, buffer);
    return { absolutePath, publicPath: `/uploads/extractions/${jobId}/${safeName}` };
  }

  extensionFor(sourceRef: string): string {
    return extname(sourceRef).toLowerCase() || '.png';
  }
}
