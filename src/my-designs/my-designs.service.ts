import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedDesign } from './entities/saved-design.entity';
import { DesignCompositionEmbed } from '../designs/entities/design-composition.embed';
import { CreateMyDesignDto } from './dto/create-my-design.dto';
import { UpdateMyDesignDto } from './dto/update-my-design.dto';
import { MaterialsService } from '../materials/materials.service';
import { DesignCompositionDto, OrderedDesignBeadDto } from '../designs/dto/create-design.dto';

const MAX_SAVED_DESIGN_BEADS = 100;

@Injectable()
export class MyDesignsService {
  constructor(
    @InjectRepository(SavedDesign)
    private readonly repo: Repository<SavedDesign>,
    private readonly materials: MaterialsService,
  ) {}

  async findAll(userId: string): Promise<SavedDesign[]> {
    return this.repo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<SavedDesign> {
    const row = await this.repo.findOne({ where: { id, userId } });
    if (!row) throw new NotFoundException(`SavedDesign ${id} not found`);
    return row;
  }

  async create(userId: string, dto: CreateMyDesignDto): Promise<SavedDesign> {
    const canonical = await this.canonicalize(dto.composition || [], dto.orderedBeads);
    const entity = this.repo.create({ userId, title: dto.title, ...canonical });
    return this.repo.save(entity);
  }

  async update(userId: string, id: string, dto: UpdateMyDesignDto): Promise<SavedDesign> {
    await this.findOne(userId, id);
    const payload: Partial<SavedDesign> = {};
    if (dto.title !== undefined) payload.title = dto.title;
    if (dto.composition !== undefined || dto.orderedBeads !== undefined) {
      Object.assign(payload, await this.canonicalize(dto.composition || [], dto.orderedBeads));
    }
    if (Object.keys(payload).length > 0) await this.repo.update({ id, userId }, payload);
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.repo.delete({ id, userId });
  }

  private async canonicalize(
    requestedComposition: DesignCompositionDto[],
    requestedOrder?: OrderedDesignBeadDto[],
  ): Promise<{
    composition: DesignCompositionEmbed[];
    orderedBeads: Array<{ materialId: string; specId: string }> | null;
  }> {
    const materialIds = [...new Set([
      ...requestedComposition.map((row) => row.materialId),
      ...(requestedOrder || []).map((row) => row.materialId),
    ])];
    if (!materialIds.length) return { composition: [], orderedBeads: null };
    const rows = await this.materials.findByIds(materialIds);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const resolveSpec = (materialId: string, specId?: string, size?: number) => {
      const material = byId.get(materialId);
      if (!material || material.status !== 'published' || !material.isAvailable) {
        throw new BadRequestException(`材料不可用: ${materialId}`);
      }
      const spec = specId
        ? material.specs.find((candidate) => candidate.specId === specId)
        : material.specs.find((candidate) => Math.abs(Number(candidate.size) - Number(size)) < 0.001);
      if (!spec) throw new BadRequestException(`${material.name} 的规格不可用`);
      return { material, spec };
    };
    const grouped = new Map<string, DesignCompositionEmbed>();
    const add = (materialId: string, specId: string | undefined, size: number | undefined, quantity: number) => {
      const { material, spec } = resolveSpec(materialId, specId, size);
      const key = `${material.id}\u0000${spec.specId}`;
      const current = grouped.get(key);
      if (current) {
        current.quantity += quantity;
        current.amount = Number((current.price * current.quantity).toFixed(2));
      } else {
        grouped.set(key, {
          materialId: material.id,
          specId: spec.specId,
          name: material.name,
          image: material.image,
          size: Number(spec.size),
          price: Number(spec.price),
          quantity,
          amount: Number((Number(spec.price) * quantity).toFixed(2)),
        });
      }
      return { materialId: material.id, specId: spec.specId };
    };

    if (requestedOrder?.length) {
      if (requestedOrder.length > MAX_SAVED_DESIGN_BEADS) {
        throw new BadRequestException(`单个设计最多保存 ${MAX_SAVED_DESIGN_BEADS} 颗珠子`);
      }
      const orderedBeads = requestedOrder.map((row) => add(row.materialId, row.specId, undefined, 1));
      return { composition: [...grouped.values()], orderedBeads };
    }

    const beadCount = requestedComposition.reduce((sum, row) => sum + row.quantity, 0);
    if (beadCount > MAX_SAVED_DESIGN_BEADS) {
      throw new BadRequestException(`单个设计最多保存 ${MAX_SAVED_DESIGN_BEADS} 颗珠子`);
    }
    for (const row of requestedComposition) add(row.materialId, row.specId, row.size, row.quantity);
    return { composition: [...grouped.values()], orderedBeads: null };
  }
}
