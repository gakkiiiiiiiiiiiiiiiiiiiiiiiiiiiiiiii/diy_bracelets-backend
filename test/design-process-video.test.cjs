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

test('interrupted video jobs fail on restart without being scheduled again', async () => {
  const runtimeDir = mkdtempSync(join(tmpdir(), 'diy-bracelets-video-restart-'));
  const interrupted = [
    { id: 'queued', status: 'queued', progress: 0, error: null, renderTokenHash: null },
    { id: 'rendering', status: 'rendering', progress: 38, error: null, renderTokenHash: 'secret-hash' },
    { id: 'encoding', status: 'encoding', progress: 88, error: null, renderTokenHash: null },
  ];
  const saved = [];
  const jobs = {
    async find() { return interrupted; },
    async save(row) { saved.push({ ...row }); return row; },
  };

  try {
    const service = new DesignProcessVideosService(
      jobs,
      { uploadDir: runtimeDir },
      { findByIds: async () => [] },
      config(true),
    );
    let scheduled = 0;
    service.schedule = () => { scheduled += 1; };
    await service.onModuleInit();

    assert.equal(scheduled, 0);
    assert.equal(saved.length, 3);
    assert.ok(saved.every((row) => row.status === 'failed'));
    assert.ok(saved.every((row) => row.error.includes('未自动重试')));
    assert.ok(saved.every((row) => row.renderTokenHash === null));
    assert.equal(saved.find((row) => row.id === 'rendering').progress, 38);
  } finally {
    rmSync(runtimeDir, { recursive: true, force: true });
  }
});

test('concurrent video submissions are admitted serially for one task executor', async () => {
  const runtimeDir = mkdtempSync(join(tmpdir(), 'diy-bracelets-video-admission-'));
  const rows = [];
  const jobs = {
    async count(options) {
      const ownerId = options.where.ownerId;
      return rows.filter((row) => (
        ['queued', 'rendering', 'encoding'].includes(row.status)
        && (!ownerId || row.ownerId === ownerId)
      )).length;
    },
    create: (row) => row,
    async save(row) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      const saved = { id: `job-${rows.length + 1}`, ...row };
      rows.push(saved);
      return saved;
    },
  };
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
    steps: [{
      id: 'step-1', action: 'add', at: 1,
      beads: [{ id: 'bead-1', materialId: 'source-clear-quartz', specId: 'source-clear-quartz-6mm-0', size: 6 }],
    }],
  };

  try {
    const service = new DesignProcessVideosService(
      jobs,
      { uploadDir: runtimeDir },
      materials,
      config(true),
    );
    service.schedule = () => {};
    const results = await Promise.allSettled([
      service.create('same-user', dto),
      service.create('same-user', dto),
    ]);

    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    assert.match(results.find((result) => result.status === 'rejected').reason.message, /正在生成/);
    assert.equal(rows.length, 1);
  } finally {
    rmSync(runtimeDir, { recursive: true, force: true });
  }
});
