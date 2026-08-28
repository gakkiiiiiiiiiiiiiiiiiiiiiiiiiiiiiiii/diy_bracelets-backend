const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { DesignsService } = require('../dist/designs/designs.service.js');
const { GoodsService } = require('../dist/goods/goods.service.js');
const { InspirationsService } = require('../dist/inspirations/inspirations.service.js');

test('public usage counters use an atomic database increment', async () => {
  let reads = 0;
  const repo = {
    findOne: async () => ({
      id: 'design-1',
      reviewStatus: 'approved',
      usageCount: reads++ ? 8 : 7,
    }),
    increment: async (criteria, field, value) => {
      assert.deepEqual(criteria, { id: 'design-1' });
      assert.equal(field, 'usageCount');
      assert.equal(value, 1);
    },
  };
  const service = new DesignsService(repo);
  const row = await service.useDesign('design-1', true);
  assert.equal(row.usageCount, 8);
});

test('goods listing supports the contest source and rejects unknown tabs', async () => {
  let requestedSource = '';
  const service = new GoodsService({
    findPublicGoods: async (source) => {
      requestedSource = source;
      return [{ id: 'contest-1', title: '大赛作品', author: '岛民', image: '/uploads/a.png', usageCount: 3, composition: [] }];
    },
  });
  const result = await service.getGoods('contest');
  assert.equal(requestedSource, 'contest');
  assert.equal(result.items[0].author, '@岛民');
  await assert.rejects(() => service.getGoods('unknown'), BadRequestException);
});

test('inspiration submissions ignore client prices and use the published material catalog', async () => {
  let created;
  const materials = {
    findByIds: async () => [{
      id: 'amethyst',
      name: '紫水晶',
      image: '/static/amethyst.png',
      status: 'published',
      isAvailable: true,
      specs: [{ specId: 'amethyst-8mm', size: 8, price: 3.5 }],
    }],
  };
  const designs = {
    create: async (dto, ownerId) => {
      created = { dto, ownerId };
      return { id: 'submission-1', ...dto };
    },
  };
  const braceletCode = { encode: () => 'ZD1.server-authoritative' };
  const service = new InspirationsService(designs, materials, braceletCode);
  await service.submit('user-1', {
    title: '  月光  ',
    author: '  岛民甲  ',
    composition: [{ materialId: 'amethyst', name: '伪造名称', image: 'https://evil.test/a.png', size: 99, price: 0.01, quantity: 99 }],
    orderedBeads: [
      { materialId: 'amethyst', specId: 'amethyst-8mm' },
      { materialId: 'amethyst', specId: 'amethyst-8mm' },
    ],
    wristCm: 16,
  });
  assert.equal(created.ownerId, 'user-1');
  assert.equal(created.dto.title, '月光');
  assert.deepEqual(created.dto.composition, [{
    materialId: 'amethyst', specId: 'amethyst-8mm', name: '紫水晶', image: '/static/amethyst.png', size: 8, price: 3.5, quantity: 2,
  }]);
  assert.equal(created.dto.braceletCode, 'ZD1.server-authoritative');
});

test('inspiration submissions reject unavailable material specifications before persistence', async () => {
  let persisted = false;
  const service = new InspirationsService(
    { create: async () => { persisted = true; } },
    { findByIds: async () => [] },
    { encode: () => 'unused' },
  );
  await assert.rejects(() => service.submit('user-1', {
    title: '无效作品',
    orderedBeads: [{ materialId: 'missing', specId: 'missing-8mm' }],
  }), BadRequestException);
  assert.equal(persisted, false);
});
