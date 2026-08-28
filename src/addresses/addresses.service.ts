import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { Address } from './entities/address.entity';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private readonly addresses: Repository<Address>,
    private readonly dataSource: DataSource,
  ) {}

  findAll(userId: string) {
    return this.addresses.find({
      where: { userId },
      order: { isDefault: 'DESC', updatedAt: 'DESC' },
    });
  }

  async findOwned(userId: string, id: string): Promise<Address> {
    const address = await this.addresses.findOne({ where: { id, userId } });
    if (!address) throw new NotFoundException('收货地址不存在');
    return address;
  }

  async create(userId: string, dto: CreateAddressDto): Promise<Address> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const count = await manager.count(Address, { where: { userId } });
      const makeDefault = dto.isDefault === true || count === 0;
      if (makeDefault) await manager.update(Address, { userId }, { isDefault: false });
      return manager.save(Address, manager.create(Address, {
        userId,
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        region: dto.region.trim(),
        detail: dto.detail.trim(),
        isDefault: makeDefault,
      }));
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto): Promise<Address> {
    const address = await this.findOwned(userId, id);
    if (dto.isDefault === false && address.isDefault) {
      throw new BadRequestException('请先将其他地址设为默认地址');
    }
    await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      if (dto.isDefault === true) await manager.update(Address, { userId }, { isDefault: false });
      const patch: Partial<Address> = {};
      if (dto.name !== undefined) patch.name = dto.name.trim();
      if (dto.phone !== undefined) patch.phone = dto.phone.trim();
      if (dto.region !== undefined) patch.region = dto.region.trim();
      if (dto.detail !== undefined) patch.detail = dto.detail.trim();
      if (dto.isDefault === true) patch.isDefault = true;
      if (Object.keys(patch).length) await manager.update(Address, { id, userId }, patch);
    });
    return this.findOwned(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const address = await this.findOwned(userId, id);
    await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      await manager.delete(Address, { id, userId });
      if (!address.isDefault) return;
      const replacement = await manager.findOne(Address, {
        where: { userId },
        order: { updatedAt: 'DESC' },
      });
      if (replacement) await manager.update(Address, replacement.id, { isDefault: true });
    });
  }
}
