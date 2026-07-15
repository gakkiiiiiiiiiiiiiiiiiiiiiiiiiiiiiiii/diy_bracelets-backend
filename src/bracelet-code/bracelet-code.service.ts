import { BadRequestException, Injectable } from '@nestjs/common';
import { MaterialsService } from '../materials/materials.service';
import { BraceletCodeV1 } from './bracelet-code.types';

@Injectable()
export class BraceletCodeService {
  constructor(private readonly materials: MaterialsService) {}

  private crc32(text: string): string {
    let crc = 0xffffffff;
    for (let i = 0; i < text.length; i += 1) {
      crc ^= text.charCodeAt(i);
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
  }

  encode(payload: BraceletCodeV1): string {
    const json = JSON.stringify(payload);
    const encoded = Buffer.from(json).toString('base64url');
    return `ZD1.${encoded}.${this.crc32(json)}`;
  }

  decode(code: string): BraceletCodeV1 {
    const [prefix, encoded, checksum, ...extra] = code.trim().split('.');
    if (prefix !== 'ZD1' || !encoded || !checksum || extra.length) throw new BadRequestException('手串代码格式错误');
    let json: string;
    try { json = Buffer.from(encoded, 'base64url').toString('utf8'); } catch { throw new BadRequestException('手串代码无法解码'); }
    if (this.crc32(json) !== checksum.toLowerCase()) throw new BadRequestException('手串代码校验失败，内容可能被截断');
    let payload: BraceletCodeV1;
    try { payload = JSON.parse(json) as BraceletCodeV1; } catch { throw new BadRequestException('手串代码内容不是有效 JSON'); }
    if (payload.v !== 1 || !Number.isFinite(payload.wristCm) || !Array.isArray(payload.beads) || payload.beads.length > 80) {
      throw new BadRequestException('不支持的手串代码内容');
    }
    return payload;
  }

  async resolve(code: string) {
    const payload = this.decode(code);
    const resolvedIds = new Map<string, string>();
    for (const bead of payload.beads) {
      if (!resolvedIds.has(bead.materialId)) resolvedIds.set(bead.materialId, await this.materials.resolveId(bead.materialId));
    }
    const rows = await this.materials.findByIds([...new Set(resolvedIds.values())]);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const missing: Array<{ index: number; materialId: string; specId: string; reason: string }> = [];
    const beads = payload.beads.map((bead, index) => {
      const resolvedMaterialId = resolvedIds.get(bead.materialId) || bead.materialId;
      const material = byId.get(resolvedMaterialId);
      const spec = material?.specs.find((item) => item.specId === bead.specId)
        ?? material?.specs.find((item) => bead.specId.includes(`${item.size}`));
      if (!material) missing.push({ index, ...bead, reason: '素材不存在' });
      else if (material.status !== 'published' || !material.isAvailable) missing.push({ index, ...bead, reason: '素材已下架' });
      else if (!spec) missing.push({ index, ...bead, reason: '规格不存在' });
      return material && spec ? {
        index, materialId: material.id, originalMaterialId: bead.materialId, specId: spec.specId,
        name: material.name, image: material.image, size: spec.size, price: spec.price, available: material.status === 'published' && material.isAvailable,
      } : null;
    });
    return {
      payload,
      beads,
      missing,
      valid: missing.length === 0,
      totalPrice: beads.reduce((sum, bead) => sum + (bead?.price || 0), 0),
      substitutions: [...resolvedIds.entries()].filter(([from, to]) => from !== to).map(([from, to]) => ({ from, to })),
    };
  }
}
