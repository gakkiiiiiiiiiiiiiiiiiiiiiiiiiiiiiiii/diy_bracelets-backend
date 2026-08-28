import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Material } from '../materials/entities/material.entity';
import { CartItemDto } from './dto/cart.dto';
import { CartCompositionSnapshot, CartItemEntity } from './entities/cart-item.entity';
import { PRODUCT_BY_ID } from './product-catalog';

export interface CanonicalCartItem {
  clientItemId: string;
  kind: 'product' | 'custom';
  productId: string | null;
  name: string;
  image: string;
  price: number;
  qty: number;
  type: string;
  spec: string;
  handCircumferenceCm?: number;
  estimatedCircumferenceCm?: number;
  composition?: CartCompositionSnapshot[];
}

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItemEntity)
    private readonly carts: Repository<CartItemEntity>,
    @InjectRepository(Material)
    private readonly materials: Repository<Material>,
    private readonly dataSource: DataSource,
  ) {}

  async getCart(userId: string) {
    const rows = await this.carts.find({ where: { userId }, order: { updatedAt: 'DESC' } });
    return { items: rows.map((row) => this.toApi(row)) };
  }

  async replaceCart(userId: string, inputs: CartItemDto[]) {
    const canonical = await this.canonicalizeItems(inputs);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(CartItemEntity, { userId });
      if (!canonical.length) return;
      await manager.save(CartItemEntity, canonical.map((item) => manager.create(CartItemEntity, {
        userId,
        clientItemId: item.clientItemId,
        kind: item.kind,
        productId: item.productId,
        name: item.name,
        image: item.image,
        spec: item.spec,
        unitPriceCents: Math.round(item.price * 100),
        quantity: item.qty,
        handCircumferenceCm: item.handCircumferenceCm ?? null,
        estimatedCircumferenceCm: item.estimatedCircumferenceCm ?? null,
        composition: item.composition ?? null,
      })));
    });
    return { items: canonical.map((item) => ({ ...item, id: item.clientItemId })) };
  }

  async canonicalizeItems(inputs: CartItemDto[]): Promise<CanonicalCartItem[]> {
    const uniqueIds = new Set<string>();
    for (const item of inputs) {
      if (uniqueIds.has(item.clientItemId)) {
        throw new BadRequestException(`购物车项目重复: ${item.clientItemId}`);
      }
      uniqueIds.add(item.clientItemId);
    }
    const materialIds = [...new Set(inputs.flatMap((item) =>
      item.kind === 'custom' ? (item.composition ?? []).map((row) => row.materialId) : [],
    ))];
    const rows = materialIds.length
      ? await this.materials.find({ where: { id: In(materialIds), status: 'published', isAvailable: true } })
      : [];
    const materialById = new Map(rows.map((material) => [material.id, material]));
    return inputs.map((item) => item.kind === 'product'
      ? this.canonicalProduct(item)
      : this.canonicalCustom(item, materialById));
  }

  private canonicalProduct(item: CartItemDto): CanonicalCartItem {
    const product = item.productId ? PRODUCT_BY_ID.get(item.productId) : null;
    if (!product) throw new BadRequestException(`商品不存在或已下架: ${item.productId ?? ''}`);
    const spec = (item.spec || product.specs[0] || '').trim();
    if (!product.specs.includes(spec)) throw new BadRequestException(`${product.name} 的规格无效`);
    return {
      clientItemId: item.clientItemId,
      kind: 'product',
      productId: product.id,
      name: product.name,
      image: product.image,
      price: product.unitPriceCents / 100,
      qty: item.qty,
      type: product.type,
      spec,
    };
  }

  private canonicalCustom(item: CartItemDto, materialById: Map<string, Material>): CanonicalCartItem {
    const composition = (item.composition ?? []).map((requested) => {
      const material = materialById.get(requested.materialId);
      if (!material) throw new BadRequestException(`材料不可用: ${requested.materialId}`);
      const spec = requested.specId
        ? material.specs.find((candidate) => candidate.specId === requested.specId)
        : material.specs.find((candidate) => Math.abs(Number(candidate.size) - requested.size) < 0.001);
      if (!spec) throw new BadRequestException(`${material.name} 的规格不可用`);
      const unitPriceCents = Math.round(Number(spec.price) * 100);
      return {
        materialId: material.id,
        name: material.name,
        image: material.image,
        size: Number(spec.size),
        price: unitPriceCents / 100,
        quantity: requested.quantity,
        amount: (unitPriceCents * requested.quantity) / 100,
      };
    });
    const beadCount = composition.reduce((sum, row) => sum + row.quantity, 0);
    if (beadCount > 300) throw new BadRequestException('单个定制商品最多包含 300 颗珠子');
    const unitPriceCents = composition.reduce(
      (sum, row) => sum + Math.round(row.price * 100) * row.quantity,
      0,
    );
    if (unitPriceCents <= 0) throw new BadRequestException('定制商品金额必须大于 0');
    return {
      clientItemId: item.clientItemId,
      kind: 'custom',
      productId: null,
      name: item.name?.trim() || 'DIY 定制手串',
      image: this.safeImage(item.image),
      price: unitPriceCents / 100,
      qty: item.qty,
      type: '定制设计',
      spec: item.spec?.trim() || '',
      handCircumferenceCm: item.handCircumferenceCm,
      estimatedCircumferenceCm: item.estimatedCircumferenceCm,
      composition,
    };
  }

  private safeImage(value?: string): string {
    const image = value?.trim() ?? '';
    if (!image) return '';
    return image.startsWith('/') || /^https:\/\//i.test(image) ? image : '';
  }

  private toApi(row: CartItemEntity) {
    return {
      id: row.clientItemId,
      clientItemId: row.clientItemId,
      kind: row.kind,
      productId: row.productId ?? undefined,
      name: row.name,
      image: row.image,
      price: row.unitPriceCents / 100,
      qty: row.quantity,
      type: row.kind === 'product' ? '标准商品' : '定制设计',
      spec: row.spec,
      handCircumferenceCm: row.handCircumferenceCm ?? undefined,
      estimatedCircumferenceCm: row.estimatedCircumferenceCm ?? undefined,
      composition: row.composition ?? undefined,
    };
  }
}
