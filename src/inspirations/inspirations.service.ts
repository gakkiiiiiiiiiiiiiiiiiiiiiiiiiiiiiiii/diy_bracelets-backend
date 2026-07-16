import { BadRequestException, Injectable } from '@nestjs/common';
import { BraceletRenderService } from '../bracelet-agent/bracelet-render.service';
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
    private readonly renderer: BraceletRenderService,
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

  async submit(dto: SubmitInspirationDto) {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('请为作品命名');
    if (!dto.orderedBeads.length) throw new BadRequestException('作品中没有可复现的珠子序列');

    const braceletCode = this.braceletCode.encode({
      v: 1,
      wristCm: dto.wristCm ?? 16,
      beads: dto.orderedBeads,
    });
    const design = await this.designs.create({
      source: 'user',
      title,
      author: dto.author?.trim() || '岛民',
      composition: dto.composition,
      orderedBeads: dto.orderedBeads,
      wristCm: dto.wristCm ?? 16,
      braceletCode,
      isInspiration: true,
      reviewStatus: 'pending',
    });

    const materialRows = await this.materials.findByIds([...new Set(dto.orderedBeads.map((bead) => bead.materialId))]);
    const byId = new Map(materialRows.map((material) => [material.id, material]));
    const renderBeads = dto.orderedBeads.flatMap((bead) => {
      const material = byId.get(bead.materialId);
      return material ? [{ material, specId: bead.specId }] : [];
    });
    if (renderBeads.length === dto.orderedBeads.length) {
      const image = await this.renderer.render(`inspiration-${design.id}`, 0, renderBeads);
      return this.designs.update(design.id, { image });
    }
    return design;
  }

  review(id: string, dto: ReviewInspirationDto) {
    if (!['approved', 'rejected'].includes(dto.status)) throw new BadRequestException('不支持的审核状态');
    return this.designs.review(id, dto.status, dto.note);
  }
}
