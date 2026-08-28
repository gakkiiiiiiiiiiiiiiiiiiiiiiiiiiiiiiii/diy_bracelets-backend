const test = require('node:test');
const assert = require('node:assert/strict');
const { BraceletAgentService } = require('../dist/bracelet-agent/bracelet-agent.service.js');
const { ExtractionService } = require('../dist/extraction/extraction.service.js');

const activeAgentStatuses = ['queued', 'analyzing', 'retrieving', 'generating', 'rendering'];
const activeExtractionStatuses = ['queued', 'recognizing', 'deduplicating', 'extracting', 'removing_background', 'validating', 'publishing'];

function countQuery(rows, statuses) {
  return {
    where() { return this; },
    async getCount() {
      return rows.filter((row) => statuses.includes(row.status)).length;
    },
  };
}

function enabledConfig(key) {
  return {
    get(name, fallback) {
      return name === key ? true : fallback;
    },
  };
}

test('concurrent bracelet agent submissions admit only one model task', async () => {
  const rows = [];
  const generations = {
    createQueryBuilder: () => countQuery(rows, activeAgentStatuses),
    create: (row) => row,
    async save(row) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      const saved = { id: `generation-${rows.length + 1}`, ...row };
      rows.push(saved);
      return saved;
    },
  };
  const service = new BraceletAgentService(
    generations,
    {},
    {},
    { configured: true },
    {},
    {},
    {},
    enabledConfig('BRACELET_AGENT_ENABLED'),
  );
  service.schedule = () => {};

  const results = await Promise.allSettled([
    service.create({ colors: ['紫色'], wristCm: 16 }),
    service.create({ colors: ['蓝色'], wristCm: 16 }),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.match(results.find((result) => result.status === 'rejected').reason.message, /正在执行/);
  assert.equal(rows.length, 1);
});

test('concurrent extraction submissions admit only one paid task', async () => {
  const rows = [];
  const jobs = {
    createQueryBuilder: () => countQuery(rows, activeExtractionStatuses),
    create: (row) => row,
    async save(row) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      const saved = { id: `extraction-${rows.length + 1}`, ...row };
      rows.push(saved);
      return saved;
    },
  };
  const service = new ExtractionService(
    jobs,
    {},
    { configured: true },
    {},
    {},
    {},
    enabledConfig('AI_EXTRACTION_ENABLED'),
  );
  service.schedule = () => {};

  const results = await Promise.allSettled([
    service.create({ sourceRefs: ['/uploads/extraction-sources/one.png'] }),
    service.create({ sourceRefs: ['/uploads/extraction-sources/two.png'] }),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.match(results.find((result) => result.status === 'rejected').reason.message, /正在执行/);
  assert.equal(rows.length, 1);
});

test('concurrent manual retries cannot enqueue the same extraction twice', async () => {
  const result = {
    id: 'result-1',
    jobId: 'job-1',
    sourceRef: '/uploads/extraction-sources/one.png',
    status: 'failed',
    error: 'provider failed',
    attempts: 1,
  };
  const job = { id: 'job-1', status: 'failed', error: 'provider failed' };
  const jobs = {
    findOne: async () => job,
    createQueryBuilder: () => countQuery([job], activeExtractionStatuses),
    save: async (row) => row,
  };
  const resultsRepository = {
    findOne: async () => result,
    save: async (row) => row,
  };
  const service = new ExtractionService(
    jobs,
    resultsRepository,
    { configured: true },
    {},
    {},
    {},
    enabledConfig('AI_EXTRACTION_ENABLED'),
  );
  service.queue = new Promise(() => {});

  const outcomes = await Promise.allSettled([
    service.retry('result-1'),
    service.retry('result-1'),
  ]);

  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1);
  assert.match(outcomes.find((outcome) => outcome.status === 'rejected').reason.message, /仅失败/);
  assert.equal(result.status, 'detected');
  assert.equal(job.status, 'queued');
});
