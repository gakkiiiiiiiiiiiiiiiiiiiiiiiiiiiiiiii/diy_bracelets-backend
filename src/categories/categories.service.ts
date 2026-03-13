import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
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
    await this.repo.delete(id);
  }
}
