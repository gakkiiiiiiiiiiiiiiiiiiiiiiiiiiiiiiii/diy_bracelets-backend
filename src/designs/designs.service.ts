import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Design, DesignSource } from './entities/design.entity';
import { DesignCompositionEmbed } from './entities/design-composition.embed';
import { CreateDesignDto } from './dto/create-design.dto';
import { UpdateDesignDto } from './dto/update-design.dto';

@Injectable()
export class DesignsService {
  constructor(
    @InjectRepository(Design)
    private readonly repo: Repository<Design>,
  ) {}

  /** 设计广场列表：按 tab 筛选 designer | user */
  async findAll(tab?: DesignSource): Promise<Design[]> {
    const where = tab ? { source: tab } : {};
    return this.repo.find({
      where,
      order: { usageCount: 'DESC', createdAt: 'DESC' },
    });
  }

  /** 设计详情（含构成表） */
  async findOne(id: string): Promise<Design> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Design ${id} not found`);
    return row;
  }

  /** 使用该设计：usageCount +1，返回设计详情供前端套用 */
  async useDesign(id: string): Promise<Design> {
    const design = await this.findOne(id);
    await this.repo.update(id, { usageCount: design.usageCount + 1 });
    return this.findOne(id);
  }

  /** 后台：新增设计师款/用户款 */
  async create(dto: CreateDesignDto): Promise<Design> {
    const composition: DesignCompositionEmbed[] = (dto.composition || []).map((c) => ({
      materialId: c.materialId,
      name: c.name,
      image: c.image,
      size: c.size,
      price: c.price,
      quantity: c.quantity,
      amount: c.price * c.quantity,
    }));
    const entity = this.repo.create({
      source: dto.source || 'designer',
      title: dto.title,
      author: dto.author ?? '',
      image: dto.image ?? '',
      images: dto.images ?? null,
      usageCount: 0,
      composition,
      orderedBeads: dto.orderedBeads ?? null,
      wristCm: dto.wristCm ?? null,
      braceletCode: dto.braceletCode ?? null,
    });
    return this.repo.save(entity);
  }

  /** 后台：更新 */
  async update(id: string, dto: UpdateDesignDto): Promise<Design> {
    await this.findOne(id);
    const payload: Partial<Design> = { ...dto } as Partial<Design>;
    if (dto.composition?.length) {
      payload.composition = dto.composition.map((c) => ({
        materialId: c.materialId,
        name: c.name,
        image: c.image,
        size: c.size,
        price: c.price,
        quantity: c.quantity,
        amount: c.price * c.quantity,
      }));
    }
    if (dto.orderedBeads) payload.orderedBeads = dto.orderedBeads;
    if (dto.wristCm !== undefined) payload.wristCm = dto.wristCm;
    if (dto.braceletCode !== undefined) payload.braceletCode = dto.braceletCode;
    await this.repo.update(id, payload);
    return this.findOne(id);
  }

  /** 后台：删除 */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
