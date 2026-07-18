import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import sharp, { OverlayOptions } from 'sharp';
import { ImageAssetsService } from '../ai/image-assets.service';
import { Material } from '../materials/entities/material.entity';

const OUTPUT_SIZE = 1024;
const CENTER_X = OUTPUT_SIZE / 2;
const CENTER_Y = 510;
const START_ANGLE = -Math.PI / 2;
const MIN_BEAD_PX = 46;
const MAX_BEAD_PX = 112;
const BEAD_PX_PER_MM = 10.35;
const MIN_RING_X = 160;
const MAX_RING_X = 342;
const RING_PERSPECTIVE = 0.76;

interface PreparedBead {
  input: Buffer;
  px: number;
  x: number;
  y: number;
  depth: number;
  transparent: boolean;
  color: string;
}

@Injectable()
export class BraceletRenderService {
  constructor(private readonly images: ImageAssetsService) {}

  private hexColor(material: Material): string {
    return material.dominantColors?.find((value) => /^#[0-9a-f]{6}$/i.test(value)) || '#d9d1e6';
  }

  private isTransparent(material: Material): boolean {
    return /通透|透明|半透明|冰透|透光/i.test(material.transparency || '');
  }

  /**
   * 仅在素材无法读取时使用。高光由大面积柔光箱、窄边缘光与底部反射组成，
   * 避免旧版单个白色圆斑造成的塑料球观感。
   */
  private fallbackSvg(material: Material, size: number): Buffer {
    const color = this.hexColor(material);
    return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="body" cx="31%" cy="24%" r="74%">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".72"/>
          <stop offset=".18" stop-color="${color}" stop-opacity=".84"/>
          <stop offset=".67" stop-color="${color}" stop-opacity=".96"/>
          <stop offset="1" stop-color="#17202a" stop-opacity=".52"/>
        </radialGradient>
        <linearGradient id="softbox" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#ffffff" stop-opacity=".72"/>
          <stop offset=".48" stop-color="#ffffff" stop-opacity=".12"/>
          <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </linearGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="1.6"/></filter>
      </defs>
      <circle cx="50" cy="50" r="47.5" fill="url(#body)" stroke="#ffffff" stroke-opacity=".34"/>
      <path d="M18 48C20 24 34 11 57 10C43 16 33 27 29 47Z" fill="url(#softbox)" filter="url(#blur)"/>
      <path d="M27 75C43 88 66 86 79 68" fill="none" stroke="#ffffff" stroke-opacity=".22" stroke-width="4" filter="url(#blur)"/>
      <path d="M82 27C90 43 89 59 80 73" fill="none" stroke="#dff7ff" stroke-opacity=".34" stroke-width="2"/>
    </svg>`);
  }

  private ringGeometry(beadSizes: number[]): { radiusX: number; radiusY: number; scale: number } {
    const rawCircumference = beadSizes.reduce((sum, size) => sum + size * 0.94, 0);
    const rawRadiusX = Math.max(MIN_RING_X, rawCircumference / (Math.PI * 2));
    const scale = Math.min(1, MAX_RING_X / rawRadiusX);
    const radiusX = rawRadiusX * scale;
    return { radiusX, radiusY: radiusX * RING_PERSPECTIVE, scale };
  }

  private cordSvg(radiusX: number, radiusY: number): Buffer {
    return Buffer.from(`<svg width="${OUTPUT_SIZE}" height="${OUTPUT_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="cordShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5"/>
        </filter>
        <linearGradient id="cord" x1="0" y1="0" x2="0" y2="1">
          <stop stop-color="#ffffff" stop-opacity=".76"/>
          <stop offset=".5" stop-color="#dbe1e2" stop-opacity=".55"/>
          <stop offset="1" stop-color="#ffffff" stop-opacity=".68"/>
        </linearGradient>
      </defs>
      <ellipse cx="${CENTER_X + 5}" cy="${CENTER_Y + 9}" rx="${radiusX}" ry="${radiusY}" fill="none" stroke="#52606a" stroke-opacity=".13" stroke-width="13" filter="url(#cordShadow)"/>
      <ellipse cx="${CENTER_X}" cy="${CENTER_Y}" rx="${radiusX}" ry="${radiusY}" fill="none" stroke="url(#cord)" stroke-width="11"/>
      <ellipse cx="${CENTER_X - 1}" cy="${CENTER_Y - 2}" rx="${radiusX}" ry="${radiusY}" fill="none" stroke="#ffffff" stroke-opacity=".44" stroke-width="3"/>
    </svg>`);
  }

  private shadowSvg(bead: PreparedBead): Buffer {
    const shadowOpacity = bead.transparent ? 0.15 : 0.22;
    const causticOpacity = bead.transparent ? 0.13 : 0;
    const rx = Math.round(bead.px * 0.43);
    const ry = Math.max(7, Math.round(bead.px * 0.15));
    return Buffer.from(`<svg width="${OUTPUT_SIZE}" height="${OUTPUT_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-80%" y="-180%" width="260%" height="460%"><feGaussianBlur stdDeviation="${Math.max(4, bead.px * 0.065)}"/></filter>
        <filter id="caustic" x="-100%" y="-220%" width="300%" height="540%"><feGaussianBlur stdDeviation="${Math.max(3, bead.px * 0.045)}"/></filter>
      </defs>
      <ellipse cx="${bead.x + bead.px * 0.075}" cy="${bead.y + bead.px * 0.42}" rx="${rx}" ry="${ry}" fill="#28343a" opacity="${shadowOpacity}" filter="url(#shadow)"/>
      <ellipse cx="${bead.x - bead.px * 0.04}" cy="${bead.y + bead.px * 0.4}" rx="${Math.round(rx * 0.66)}" ry="${Math.max(4, Math.round(ry * 0.55))}" fill="${bead.color}" opacity="${causticOpacity}" filter="url(#caustic)"/>
    </svg>`);
  }

  private async normalizeBeadAsset(input: Buffer, material: Material, px: number): Promise<Buffer> {
    try {
      return await sharp(input)
        .ensureAlpha()
        .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 3 })
        .resize(px, px, {
          fit: 'contain',
          kernel: sharp.kernel.lanczos3,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer();
    } catch {
      return sharp(this.fallbackSvg(material, px)).png().toBuffer();
    }
  }

  async render(generationId: string, index: number, beads: Array<{ material: Material; specId: string }>): Promise<string> {
    const count = Math.max(beads.length, 1);
    const baseSizes = beads.map((entry) => {
      const spec = entry.material.specs.find((item) => item.specId === entry.specId) || entry.material.specs[0];
      return Math.max(MIN_BEAD_PX, Math.min(MAX_BEAD_PX, Math.round((spec?.size || 8) * BEAD_PX_PER_MM)));
    });
    const { radiusX, radiusY, scale } = this.ringGeometry(baseSizes);

    const prepared = await Promise.all(beads.map(async (entry, beadIndex): Promise<PreparedBead> => {
      const angle = START_ANGLE + (beadIndex / count) * Math.PI * 2;
      // 前排珠子略大、后排略小，保持轻微棚拍透视，同时不改变有序位置。
      const perspectiveScale = 0.92 + ((Math.sin(angle) + 1) / 2) * 0.14;
      const px = Math.max(38, Math.round(baseSizes[beadIndex] * scale * perspectiveScale));
      let source: Buffer;
      try {
        source = (await this.images.load(entry.material.image)).buffer;
      } catch {
        source = this.fallbackSvg(entry.material, px);
      }
      const input = await this.normalizeBeadAsset(source, entry.material, px);
      return {
        input,
        px,
        x: CENTER_X + Math.cos(angle) * radiusX,
        y: CENTER_Y + Math.sin(angle) * radiusY,
        depth: Math.sin(angle),
        transparent: this.isTransparent(entry.material),
        color: this.hexColor(entry.material),
      };
    }));

    const composites: OverlayOptions[] = prepared.length
      ? [{ input: this.cordSvg(radiusX, radiusY), left: 0, top: 0 }]
      : [];
    for (const bead of prepared) composites.push({ input: this.shadowSvg(bead), left: 0, top: 0 });
    // 后排先绘制、前排后绘制，珠子轻微相接时得到自然遮挡关系。
    for (const bead of [...prepared].sort((a, b) => a.depth - b.depth)) {
      composites.push({
        input: bead.input,
        left: Math.round(bead.x - bead.px / 2),
        top: Math.round(bead.y - bead.px / 2),
      });
    }

    const output = await sharp({
      create: {
        width: OUTPUT_SIZE,
        height: OUTPUT_SIZE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(composites)
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    const dir = join(this.images.uploadDir, 'agent', generationId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${index}.png`), output);
    return `/uploads/agent/${generationId}/${index}.png`;
  }
}
