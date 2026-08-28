import { BadRequestException, Injectable } from '@nestjs/common';
import { BraceletCodeService } from '../bracelet-code/bracelet-code.service';
import { DesignsService } from '../designs/designs.service';
import type { DesignReviewStatus } from '../designs/entities/design.entity';
import { MaterialsService } from '../materials/materials.service';
import { ReviewInspirationDto, SubmitInspirationDto } from './dto/submit-inspiration.dto';

@Injectable()
export class InspirationsService {
  constructor(
    private readonly designs: DesignsService,
    private readonly materials: MaterialsService,
    private readonly braceletCode: BraceletCodeService,
  ) {}

  listPublic() {
    return this.designs.findInspirations('approved');
  }

  listForReview(status: DesignReviewStatus = 'pending') {
    return this.designs.findInspirations(status);
  }

  findOne(id: string) {
    return this.designs.findPublicInspiration(id);
  }

  async use(id: string) {
    await this.designs.findPublicInspiration(id);
    return this.designs.useDesign(id);
  }

  async randomUse() {
    const design = await this.designs.findRandomInspiration();
    return this.designs.useDesign(design.id);
  }

  async submit(userId: string, dto: SubmitInspirationDto) {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('请为作品命名');
    if (!dto.orderedBeads.length) throw new BadRequestException('作品中没有可复现的珠子序列');

    const materialRows = await this.materials.findByIds([...new Set(dto.orderedBeads.map((bead) => bead.materialId))]);
    const byId = new Map(materialRows.map((material) => [material.id, material]));
    const grouped = new Map<string, {
      materialId: string; specId: string; name: string; image: string; size: number; price: number; quantity: number;
    }>();
    for (const bead of dto.orderedBeads) {
      const material = byId.get(bead.materialId);
      const spec = material?.specs.find((candidate) => candidate.specId === bead.specId);
      if (!material || material.status !== 'published' || !material.isAvailable || !spec) {
        throw new BadRequestException(`素材或规格不可用: ${bead.materialId}/${bead.specId}`);
      }
      const key = `${material.id}\u0000${spec.specId}`;
      const current = grouped.get(key);
      if (current) current.quantity += 1;
      else grouped.set(key, {
        materialId: material.id,
        specId: spec.specId,
        name: material.name,
        image: material.image,
        size: Number(spec.size),
        price: Number(spec.price),
        quantity: 1,
      });
    }
    const composition = [...grouped.values()];

    const braceletCode = this.braceletCode.encode({
      v: 1,
      wristCm: dto.wristCm ?? 16,
      beads: dto.orderedBeads,
    });
    const design = await this.designs.create({
      source: 'user',
      title,
      author: dto.author?.trim() || '岛民',
      image: composition[0]?.image ?? '',
      composition,
      orderedBeads: dto.orderedBeads,
      wristCm: dto.wristCm ?? 16,
      braceletCode,
      isInspiration: true,
      reviewStatus: 'pending',
    }, userId);
    return design;
  }

  review(id: string, dto: ReviewInspirationDto) {
    if (!['approved', 'rejected'].includes(dto.status)) throw new BadRequestException('不支持的审核状态');
    return this.designs.review(id, dto.status, dto.note);
  }
}
