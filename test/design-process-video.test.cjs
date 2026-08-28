const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DesignProcessVideosService } = require('../dist/design-process-videos/design-process-videos.service.js');

function config(enabled) {
  return {
    get(key, fallback) {
      if (key === 'DESIGN_PROCESS_VIDEO_ENABLED') return enabled;
      if (key === 'VIDEO_WEB_RENDER_URL') return 'https://app.example.com/#/pages/design/design';
      if (key === 'CHROME_PATH') return '/missing/chromium';
      return fallback;
    },
  };
}

function repository(savedRows) {
  return {
    count: async () => 0,
    create: (row) => row,
    save: async (row) => {
      const saved = { id: '11111111-1111-4111-8111-111111111111', ...row };
      savedRows.push(saved);
      return saved;
    },
  };
}

test('video jobs are opt-in and replace client material metadata with the published catalog', async () => {
  const runtimeDir = mkdtempSync(join(tmpdir(), 'diy-bracelets-video-'));
  const rows = [];
  const materials = {
    findByIds: async () => [{
      id: 'source-clear-quartz',
      name: '净体白水晶',
      image: '/static/materials/reference-crystals/clear-quartz/clear-quartz-preview.png',
      status: 'published',
      isAvailable: true,
      specs: [{ specId: 'source-clear-quartz-6mm-0', size: 6, price: 3 }],
    }],
  };
  const dto = {
    wristCm: 16,
    steps: [{
      id: 'step-1',
      action: 'add',
      at: 1,
      beads: [{
        id: 'bead-1',
        materialId: 'source-clear-quartz',
        specId: 'source-clear-quartz-6mm-0',
        name: '伪造名称',
        image: 'http://127.0.0.1/internal.png',
        size: 99,
        price: 0,
        orderIndex: 99,
      }],
    }],
    palette: [],
  };

  try {
    const disabled = new DesignProcessVideosService(
      repository([]),
      { uploadDir: runtimeDir },
      materials,
      config(false),
    );
    await assert.rejects(() => disabled.create('user-1', dto), /尚未启用/);

    const enabled = new DesignProcessVideosService(
      repository(rows),
      { uploadDir: runtimeDir },
      materials,
      config(true),
    );
    enabled.schedule = () => {};
    const created = await enabled.create('user-1', dto);
    const bead = created.steps[0].beads[0];
    assert.equal(bead.name, '净体白水晶');
    assert.equal(bead.image, '/static/materials/reference-crystals/clear-quartz/clear-quartz-preview.png');
    assert.equal(bead.size, 6);
    assert.equal(bead.price, 3);
    assert.equal(bead.orderIndex, 0);
  } finally {
    rmSync(runtimeDir, { recursive: true, force: true });
  }
});

test('internal render reads require a valid token and never return its hash', async () => {
  const runtimeDir = mkdtempSync(join(tmpdir(), 'diy-bracelets-video-token-'));
  const token = 'A'.repeat(43);
  const row = {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'rendering',
    renderTokenHash: createHash('sha256').update(token).digest('hex'),
  };
  const jobs = repository([]);
  jobs.createQueryBuilder = () => ({
    addSelect() { return this; },
    where() { return this; },
    async getOne() { return { ...row }; },
  });

  try {
    const service = new DesignProcessVideosService(
      jobs,
      { uploadDir: runtimeDir },
      { findByIds: async () => [] },
      config(true),
    );
    await assert.rejects(() => service.findForRender(row.id, 'B'.repeat(43)), /渲染令牌无效/);
    const safe = await service.findForRender(row.id, token);
    assert.equal('renderTokenHash' in safe, false);
  } finally {
    rmSync(runtimeDir, { recursive: true, force: true });
  }
});
