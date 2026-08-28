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
    const composition: DesignCompositionEmbed[] = (dto.composition || []).map((c) => ({
      materialId: c.materialId,
      name: c.name,
      image: c.image,
      size: c.size,
      price: c.price,
      quantity: c.quantity,
      amount: c.price * c.quantity,
    }));
    const entity = this.repo.create({ userId, title: dto.title, composition });
    return this.repo.save(entity);
  }

  async update(userId: string, id: string, dto: UpdateMyDesignDto): Promise<SavedDesign> {
    await this.findOne(userId, id);
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
    if (Object.keys(payload).length > 0) await this.repo.update({ id, userId }, payload);
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.repo.delete({ id, userId });
  }
}
