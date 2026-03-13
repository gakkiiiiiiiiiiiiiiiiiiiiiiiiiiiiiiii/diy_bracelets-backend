import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Material } from './entities/material.entity';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(Material)
    private readonly repo: Repository<Material>,
  ) {}

  async findAll(): Promise<Material[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  async findOne(id: string): Promise<Material> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Material ${id} not found`);
    return row;
  }

  async create(dto: CreateMaterialDto): Promise<Material> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateMaterialDto): Promise<Material> {
    await this.findOne(id);
    await this.repo.update(id, dto as Partial<Material>);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
