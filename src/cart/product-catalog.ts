export interface CatalogProduct {
  id: string;
  categoryId: 'discount' | 'rabbit-hair' | 'services';
  type: string;
  name: string;
  image: string;
  unitPriceCents: number;
  specs: string[];
}

export const PRODUCT_CATALOG: readonly CatalogProduct[] = [
  { id: 'shop-white-bubble-bracelet', categoryId: 'discount', type: '标准商品', name: '天然双A白水超净体泡泡串', image: '/static/shop-goods/white-bubble-list.jpg', unitPriceCents: 28_000, specs: ['12mm'] },
  { id: 'shop-silver-obsidian', categoryId: 'discount', type: '标准商品', name: '顶级陨石银曜石手串', image: '/static/shop-goods/silver-obsidian-list.jpg', unitPriceCents: 19_800, specs: ['10mm', '12mm'] },
  { id: 'shop-morganite', categoryId: 'discount', type: '标准商品', name: '摩根石', image: '/static/shop-goods/morganite-list.jpg', unitPriceCents: 16_800, specs: ['8mm', '10mm'] },
  { id: 'shop-cleansing-bowl', categoryId: 'discount', type: '标准商品', name: '水晶消磁碗套装', image: '/static/shop-goods/cleansing-bowl-list.jpg', unitPriceCents: 8_800, specs: ['套装'] },
  { id: 'shop-rabbit-clear', categoryId: 'rabbit-hair', type: '标准商品', name: '兔毛水晶手串', image: '/static/shop-goods/rabbit-clear-bracelet.jpg', unitPriceCents: 23_800, specs: ['8mm', '10mm'] },
  { id: 'shop-rabbit-red', categoryId: 'rabbit-hair', type: '标准商品', name: '红兔毛水晶散珠', image: '/static/shop-goods/rabbit-red-beads.jpg', unitPriceCents: 3_200, specs: ['8mm', '10mm', '12mm'] },
  { id: 'shop-rabbit-green', categoryId: 'rabbit-hair', type: '标准商品', name: '绿兔毛水晶散珠', image: '/static/shop-goods/rabbit-green-beads.jpg', unitPriceCents: 3_600, specs: ['8mm', '10mm'] },
  { id: 'shop-certificate-service', categoryId: 'services', type: '标准商品', name: '中检检测证书服务', image: '/static/shop-goods/certificate-service.png', unitPriceCents: 4_500, specs: ['一次'] },
  { id: 'shop-price-difference', categoryId: 'services', type: '标准商品', name: '差价补齐', image: '/static/shop-goods/price-difference.png', unitPriceCents: 100, specs: ['补差价'] },
] as const;

export const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
