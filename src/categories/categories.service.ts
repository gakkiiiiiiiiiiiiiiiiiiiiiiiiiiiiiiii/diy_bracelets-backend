import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Material } from '../materials/entities/material.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<Category[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  async findOne(id: string): Promise<Category> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Category ${id} not found`);
    return row;
  }

  async create(dto: { id: string; name: string }): Promise<Category> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async update(id: string, dto: { name?: string }): Promise<Category> {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    const materialCount = await this.dataSource.getRepository(Material).count({ where: { categoryId: id } });
    if (materialCount > 0) {
      throw new ConflictException(`分类下仍有 ${materialCount} 个材料，请先迁移或停用材料`);
    }
    await this.repo.delete(id);
  }
}
