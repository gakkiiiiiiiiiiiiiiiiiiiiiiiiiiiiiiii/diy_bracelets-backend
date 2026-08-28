import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Material } from './entities/material.entity';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { MaterialAlias } from './entities/material-alias.entity';
import { CategoriesService } from '../categories/categories.service';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(Material)
    private readonly repo: Repository<Material>,
    @InjectRepository(MaterialAlias)
    private readonly aliasRepo: Repository<MaterialAlias>,
    private readonly categories: CategoriesService,
  ) {}

  private normalize(entity: Material): Material {
    entity.specs = (entity.specs || []).map((spec, index) => ({
      ...spec,
      specId: spec.specId || `${entity.id}-${spec.size}mm-${index}`,
    }));
    entity.aliases ??= [];
    entity.dominantColors ??= [];
    entity.sourceRefs ??= [];
    entity.confidence ??= {};
    entity.manualOverrides ??= [];
    entity.assetBundle ??= {};
    return entity;
  }

  async findAll(): Promise<Material[]> {
    const rows = await this.repo.find({ order: { id: 'ASC' } });
    return Promise.all(rows.map(async (row) => {
      const missingSpecId = (row.specs || []).some((spec) => !spec.specId);
      const normalized = this.normalize(row);
      if (missingSpecId) await this.repo.save(normalized);
      return normalized;
    }));
  }

  async findOne(id: string): Promise<Material> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Material ${id} not found`);
    const normalized = this.normalize(row);
    await this.repo.save(normalized);
    return normalized;
  }

  async create(dto: CreateMaterialDto): Promise<Material> {
    await this.categories.findOne(dto.categoryId);
    const entity = this.normalize(this.repo.create({
      ...dto,
      generatedBy: dto.generatedBy ?? 'manual',
      status: dto.status ?? 'published',
      isAvailable: dto.isAvailable ?? true,
    }));
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateMaterialDto): Promise<Material> {
    if (dto.categoryId) await this.categories.findOne(dto.categoryId);
    const current = await this.findOne(id);
    const manualOverrides = new Set(current.manualOverrides || []);
    if (current.generatedBy === 'imagegen') {
      Object.keys(dto).forEach((key) => {
        if (!['sourceRefs', 'embedding', 'assetBundle', 'confidence'].includes(key)) manualOverrides.add(key);
      });
    }
    const payload = this.normalize(this.repo.merge(current, dto as Partial<Material>, {
      manualOverrides: [...manualOverrides],
    }));
    await this.repo.save(payload);
    return this.findOne(id);
  }

  async findPublished(): Promise<Material[]> {
    const rows = await this.repo.find({ where: { status: 'published', isAvailable: true }, order: { id: 'ASC' } });
    return rows.map((row) => this.normalize(row));
  }

  async findPublishedOne(id: string): Promise<Material> {
    const row = await this.repo.findOne({
      where: { id, status: 'published', isAvailable: true },
    });
    if (!row) throw new NotFoundException(`Material ${id} not found`);
    return this.normalize(row);
  }

  async findByIds(ids: string[]): Promise<Material[]> {
    if (!ids.length) return [];
    return (await this.repo.find({ where: { id: In(ids) } })).map((row) => this.normalize(row));
  }

  async resolveId(id: string): Promise<string> {
    const direct = await this.repo.findOne({ where: { id } });
    if (direct) return id;
    const alias = await this.aliasRepo.findOne({ where: { fromId: id } });
    return alias?.toId ?? id;
  }

  async addAlias(fromId: string, toId: string): Promise<void> {
    await this.aliasRepo.save(this.aliasRepo.create({ fromId, toId }));
  }

  async remove(id: string): Promise<Material> {
    const material = await this.findOne(id);
    material.status = 'disabled';
    material.isAvailable = false;
    await this.repo.save(material);
    return this.findOne(id);
  }
}
