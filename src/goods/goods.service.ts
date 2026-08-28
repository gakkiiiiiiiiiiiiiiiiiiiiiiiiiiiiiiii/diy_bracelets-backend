import { BadRequestException, Injectable } from '@nestjs/common';
import { DesignsService } from '../designs/designs.service';
import type { DesignSource } from '../designs/entities/design.entity';
import type { DesignCompositionEmbed } from '../designs/entities/design-composition.embed';

/** 设计广场列表项（与前端 PlazaItem 对齐） */
export interface GoodsListItem {
  id: string;
  title: string;
  author: string;
  image: string;
  cta: string;
  usageCount: number;
  composition: DesignCompositionEmbed[];
}

@Injectable()
export class GoodsService {
  constructor(private readonly designsService: DesignsService) {}

  /** 设计广场列表：tab=designer | user | contest，默认 designer */
  async getGoods(tab?: string): Promise<{ items: GoodsListItem[] }> {
    const source = (tab || 'designer') as DesignSource;
    if (!['designer', 'user', 'contest'].includes(source)) {
      throw new BadRequestException('tab 仅支持 designer、user 或 contest');
    }
    const list = await this.designsService.findPublicGoods(source);
    const items: GoodsListItem[] = list.map((d) => ({
      id: d.id,
      title: d.title,
      author: d.author ? (d.author.startsWith('@') ? d.author : `@${d.author}`) : '',
      image: d.image,
      cta: '查看实物',
      usageCount: d.usageCount,
      composition: d.composition,
    }));
    return { items };
  }

  /** 设计详情（含构成表） */
  async getGoodsById(id: string) {
    return this.designsService.findPublicOne(id);
  }

  /** 使用该设计：usageCount+1，返回设计详情供前端套用到 DIY */
  async useDesign(id: string) {
    return this.designsService.useDesign(id, true);
  }
}
