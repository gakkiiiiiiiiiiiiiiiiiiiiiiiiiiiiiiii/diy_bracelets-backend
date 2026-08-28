import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UpdateProfileDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async getProfile(userId: string) {
    return this.toProfile(await this.findUser(userId));
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.findUser(userId);
    user.displayName = dto.displayName.trim();
    return this.toProfile(await this.users.save(user));
  }

  private async findUser(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  private toProfile(user: User) {
    return {
      name: user.displayName || '珠岛用户',
      avatarUrl: user.avatarUrl,
      greeting: '您好！欢迎来到珠岛',
      entries: [
        { id: 'design', label: '我的设计', sub: '查看已保存的设计记录', icon: 'D' },
        { id: 'orders', label: '我的订单', sub: '定制记录、购买记录', icon: 'O' },
        { id: 'address', label: '收货地址', sub: '完善地址，方便下单', icon: 'A' },
        { id: 'help', label: '帮助中心', sub: '有什么问题请联系客服处理', icon: 'H' },
        { id: 'terms', label: '条款和条件', sub: '我们的服务', icon: 'T' },
      ],
    };
  }
}
