import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import sharp, { OverlayOptions } from 'sharp';
import { ImageAssetsService } from '../ai/image-assets.service';
import { Material } from '../materials/entities/material.entity';

@Injectable()
export class BraceletRenderService {
  constructor(private readonly images: ImageAssetsService) {}

  private fallbackSvg(material: Material, size: number): Buffer {
    const color = material.dominantColors?.find((value) => /^#[0-9a-f]{6}$/i.test(value)) || '#d9d1e6';
    return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g" cx="35%" cy="28%"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".35" stop-color="${color}" stop-opacity=".88"/><stop offset="1" stop-color="${color}" stop-opacity=".58"/></radialGradient></defs><circle cx="50%" cy="50%" r="48%" fill="url(#g)" stroke="#fff" stroke-opacity=".45"/></svg>`);
  }

  async render(generationId: string, index: number, beads: Array<{ material: Material; specId: string }>): Promise<string> {
    const composites: OverlayOptions[] = [];
    const count = Math.max(beads.length, 1);
    const radius = Math.min(350, 220 + count * 4.5);
    for (let i = 0; i < beads.length; i += 1) {
      const entry = beads[i];
      const spec = entry.material.specs.find((item) => item.specId === entry.specId) || entry.material.specs[0];
      const px = Math.max(42, Math.min(92, Math.round((spec?.size || 8) * 6.5)));
      let input: Buffer;
      try { input = (await this.images.load(entry.material.image)).buffer; } catch { input = this.fallbackSvg(entry.material, px); }
      const bead = await sharp(input).resize(px, px, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
      composites.push({ input: bead, left: Math.round(512 + Math.cos(angle) * radius - px / 2), top: Math.round(512 + Math.sin(angle) * radius - px / 2) });
    }
    const output = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(composites).png().toBuffer();
    const dir = join(this.images.uploadDir, 'agent', generationId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${index}.png`), output);
    return `/uploads/agent/${generationId}/${index}.png`;
  }
}
