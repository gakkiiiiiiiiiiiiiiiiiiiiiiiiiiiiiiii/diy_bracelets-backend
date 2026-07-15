const test = require('node:test');
const assert = require('node:assert/strict');
const { BraceletCodeService } = require('../dist/bracelet-code/bracelet-code.service');

const material = {
  id: 'amethyst', name: '紫水晶', image: '/amethyst.png', status: 'published', isAvailable: true,
  specs: [{ specId: 'amethyst-8mm', size: 8, price: 3 }],
};
const materials = {
  resolveId: async (id) => id === 'legacy-amethyst' ? 'amethyst' : id,
  findByIds: async (ids) => ids.includes('amethyst') ? [material] : [],
};

test('ZD1 code round-trips exact ordered beads and resolves aliases', async () => {
  const service = new BraceletCodeService(materials);
  const payload = { v: 1, wristCm: 16, beads: [
    { materialId: 'legacy-amethyst', specId: 'amethyst-8mm' },
    { materialId: 'amethyst', specId: 'amethyst-8mm' },
  ] };
  const code = service.encode(payload);
  assert.match(code, /^ZD1\./);
  assert.deepEqual(service.decode(code), payload);
  const resolved = await service.resolve(code);
  assert.equal(resolved.valid, true);
  assert.deepEqual(resolved.beads.map((bead) => bead.materialId), ['amethyst', 'amethyst']);
  assert.deepEqual(resolved.substitutions, [{ from: 'legacy-amethyst', to: 'amethyst' }]);
});

test('ZD1 rejects a damaged checksum', () => {
  const service = new BraceletCodeService(materials);
  const code = service.encode({ v: 1, wristCm: 16, beads: [] });
  const last = code.at(-1);
  assert.throws(() => service.decode(`${code.slice(0, -1)}${last === '0' ? '1' : '0'}`));
});
