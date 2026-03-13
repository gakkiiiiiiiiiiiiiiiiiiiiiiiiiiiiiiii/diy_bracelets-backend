import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedDesign } from './entities/saved-design.entity';
import { DesignCompositionEmbed } from '../designs/entities/design-composition.embed';
import { CreateMyDesignDto } from './dto/create-my-design.dto';
import { UpdateMyDesignDto } from './dto/update-my-design.dto';

@Injectable()
export class MyDesignsService {
  constructor(
    @InjectRepository(SavedDesign)
    private readonly repo: Repository<SavedDesign>,
  ) {}

  async findAll(): Promise<SavedDesign[]> {
    return this.repo.find({
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<SavedDesign> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`SavedDesign ${id} not found`);
    return row;
  }

  async create(dto: CreateMyDesignDto): Promise<SavedDesign> {
    const composition: DesignCompositionEmbed[] = (dto.composition || []).map((c) => ({
      materialId: c.materialId,
      name: c.name,
      image: c.image,
      size: c.size,
      price: c.price,
      quantity: c.quantity,
      amount: c.price * c.quantity,
    }));
    const entity = this.repo.create({ title: dto.title, composition });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateMyDesignDto): Promise<SavedDesign> {
    await this.findOne(id);
    const payload: Partial<SavedDesign> = {};
    if (dto.title !== undefined) payload.title = dto.title;
    if (dto.composition?.length !== undefined) {
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
    if (Object.keys(payload).length > 0) await this.repo.update(id, payload);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
