export interface ReferenceCatalogCategory {
  id: string;
  name: string;
}

export interface ReferenceCatalogSpec {
  specId: string;
  size: number;
  price: number;
}

export interface ReferenceCatalogMaterial {
  id: string;
  name: string;
  image: string;
  categoryId: string;
  specs: ReferenceCatalogSpec[];
}

export const REFERENCE_CATALOG_CATEGORIES: readonly ReferenceCatalogCategory[] = [
  { id: 'yellow-series', name: '黄色系' },
  { id: 'pink-series', name: '粉红系' },
  { id: 'green-white-series', name: '绿白系' },
  { id: 'blue-series', name: '蓝色系' },
  { id: 'purple-series', name: '紫色系' },
] as const;

const ROOT = '/static/materials/reference-crystals';
const SPECS_BY_TIER: Record<number, Array<{ size: number; price: number }>> = {
  1: [{ size: 6, price: 3 }, { size: 8, price: 5 }, { size: 10, price: 10 }, { size: 12, price: 15 }],
  2: [{ size: 6, price: 4 }, { size: 8, price: 7 }, { size: 10, price: 12 }, { size: 12, price: 18 }],
  3: [{ size: 6, price: 6 }, { size: 8, price: 10 }, { size: 10, price: 18 }, { size: 12, price: 28 }],
  4: [{ size: 6, price: 8 }, { size: 8, price: 14 }, { size: 10, price: 26 }, { size: 12, price: 38 }],
};

function specs(id: string, rows: Array<{ size: number; price: number }>): ReferenceCatalogSpec[] {
  return rows.map((row, index) => ({
    specId: `${id}-${row.size}mm-${index}`,
    ...row,
  }));
}

function material(
  id: string,
  slug: string,
  name: string,
  categoryId: string,
  priceTier: number,
): ReferenceCatalogMaterial {
  return {
    id,
    name,
    image: `${ROOT}/${slug}/${slug}-preview.png`,
    categoryId,
    specs: specs(id, SPECS_BY_TIER[priceTier]),
  };
}

function sourceMaterial(
  id: string,
  slug: string,
  name: string,
  categoryId: string,
  rows: Array<{ size: number; price: number }>,
): ReferenceCatalogMaterial {
  return {
    id,
    name,
    image: `${ROOT}/${slug}/${slug}-preview.png`,
    categoryId,
    specs: specs(id, rows),
  };
}

export const REFERENCE_CATALOG_MATERIALS: readonly ReferenceCatalogMaterial[] = [
  sourceMaterial('source-clear-quartz', 'clear-quartz', '净体白水晶', 'green-white-series', [
    { size: 6, price: 3 }, { size: 8, price: 5 }, { size: 10, price: 10 }, { size: 12, price: 15 },
  ]),
  sourceMaterial('source-milky-quartz', 'blue-moonstone', '奶白晶', 'green-white-series', [
    { size: 8, price: 4 }, { size: 10, price: 8 },
  ]),
  sourceMaterial('source-uruguay-amethyst', 'uruguay-amethyst', '乌拉圭紫水晶', 'purple-series', [
    { size: 8, price: 10 }, { size: 10, price: 16 }, { size: 12, price: 24 },
  ]),
  sourceMaterial('source-brazil-amethyst', 'brazil-amethyst', '巴西紫水晶', 'purple-series', [
    { size: 8, price: 18 }, { size: 10, price: 37 }, { size: 12, price: 56 },
  ]),
  sourceMaterial('source-brazil-citrine', 'yellow-crystal', '巴西黄水晶', 'yellow-series', [
    { size: 8, price: 32 }, { size: 10, price: 67 },
  ]),
  sourceMaterial('source-lemon-citrine', 'yellow-ase', '透体柠檬黄水晶', 'yellow-series', [
    { size: 8, price: 6 }, { size: 10, price: 12 }, { size: 12, price: 19 },
  ]),
  sourceMaterial('source-yellow-tower', 'yellow-tower', '黄塔晶', 'yellow-series', [
    { size: 8, price: 6.5 },
  ]),
  sourceMaterial('source-starlight-rose-quartz', 'pink-crystal', '星光粉晶', 'pink-series', [
    { size: 8, price: 9 }, { size: 10, price: 18 }, { size: 12, price: 28 },
  ]),
  sourceMaterial('source-purple-rose-quartz', 'strawberry-crystal', '紫粉晶', 'pink-series', [
    { size: 8, price: 5 }, { size: 10, price: 9 }, { size: 12, price: 14 },
  ]),

  material('ref-yellow-crystal', 'yellow-crystal', '黄水晶', 'yellow-series', 2),
  material('ref-golden-rutile', 'golden-rutile', '金发晶', 'yellow-series', 4),
  material('ref-yellow-ase', 'yellow-ase', '黄阿塞', 'yellow-series', 3),
  material('ref-yellow-tower', 'yellow-tower', '黄塔晶', 'yellow-series', 3),
  material('ref-yellow-tiger-eye', 'yellow-tiger-eye', '黄虎眼', 'yellow-series', 3),
  material('ref-red-garden-quartz', 'red-garden-quartz', '红胶花', 'yellow-series', 3),

  material('ref-pink-crystal', 'pink-crystal', '粉水晶', 'pink-series', 1),
  material('ref-pink-phantom', 'pink-phantom', '粉幽灵', 'pink-series', 2),
  material('ref-pink-ase', 'pink-ase', '粉阿塞', 'pink-series', 2),
  material('ref-rose-stone', 'rose-stone', '蔷薇石', 'pink-series', 2),
  material('ref-strawberry-crystal', 'strawberry-crystal', '草莓晶', 'pink-series', 3),
  material('ref-rhodochrosite', 'rhodochrosite', '红纹石', 'pink-series', 2),

  material('ref-starry-quartz', 'starry-quartz', '满天星', 'green-white-series', 1),
  material('ref-layered-green-phantom', 'layered-green-phantom', '绿幽灵千层', 'green-white-series', 3),
  material('ref-green-rutile', 'green-rutile', '绿发晶', 'green-white-series', 4),
  material('ref-prehnite', 'prehnite', '葡萄石', 'green-white-series', 2),
  material('ref-peridot', 'peridot', '橄榄石', 'green-white-series', 3),
  material('ref-green-phantom', 'green-phantom', '绿幽灵', 'green-white-series', 3),

  material('ref-blue-moonstone', 'blue-moonstone', '蓝月光', 'blue-series', 2),
  material('ref-aquamarine-ice', 'aquamarine-ice', '海蓝宝冰种', 'blue-series', 3),
  material('ref-devil-blue', 'devil-blue', '魔鬼蓝', 'blue-series', 3),
  material('ref-kyanite', 'kyanite', '蓝晶石', 'blue-series', 3),
  material('ref-larimar', 'larimar', '海纹石', 'blue-series', 4),
  material('ref-amazonite', 'amazonite', '天河石', 'blue-series', 2),

  material('ref-bolivian-amethyst', 'bolivian-amethyst', '玻利维亚紫', 'purple-series', 2),
  material('ref-lavender-amethyst', 'lavender-amethyst', '薰衣草紫', 'purple-series', 2),
  material('ref-brazil-amethyst', 'brazil-amethyst', '巴西紫', 'purple-series', 3),
  material('ref-kunzite-purple', 'kunzite-purple', '紫锂辉', 'purple-series', 3),
  material('ref-purple-phantom', 'purple-phantom', '紫幽灵', 'purple-series', 3),
  material('ref-uruguay-amethyst', 'uruguay-amethyst', '乌拉圭紫', 'purple-series', 4),
] as const;
