const assert = require('node:assert/strict');
const { chmod, mkdtemp, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { ConfigService } = require('@nestjs/config');
const { CodexCliProviderService } = require('../dist/ai/codex-cli-provider.service');

test('Codex CLI provider uses structured output from a local executable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codex-provider-test-'));
  const executable = join(dir, 'fake-codex');
  const candidate = {
    title: '本地搭配',
    rationale: '测试结构化输出',
    beads: Array.from({ length: 8 }, () => ({ materialId: 'm1', specId: 'm1-8mm' })),
  };
  const script = `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const output = args[args.indexOf('--output-last-message') + 1];
process.stdin.resume();
process.stdin.on('end', () => {
  fs.writeFileSync(output, JSON.stringify({ candidates: [${JSON.stringify(candidate)}, ${JSON.stringify(candidate)}, ${JSON.stringify(candidate)}] }));
});
`;
  await writeFile(executable, script, 'utf8');
  await chmod(executable, 0o755);

  try {
    const provider = new CodexCliProviderService(new ConfigService({
      CODEX_CLI_PATH: executable,
      CODEX_CLI_TIMEOUT_MS: 10_000,
    }));
    assert.equal(provider.configured, true);
    assert.equal(provider.status().provider, 'codex-cli');
    const result = await provider.generateBracelets({
      colors: ['#ffffff'], wristCm: 16, inventory: [{
        materialId: 'm1', name: '白水晶', colors: ['#ffffff'], transparency: '透明', pattern: '净体',
        specs: [{ specId: 'm1-8mm', size: 8, price: 2 }],
      }],
    });
    assert.equal(result.length, 3);
    assert.equal(result[0].beads[0].materialId, 'm1');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Codex CLI provider reports a missing executable', () => {
  const provider = new CodexCliProviderService(new ConfigService({ CODEX_CLI_PATH: '/missing/codex' }));
  assert.equal(provider.configured, false);
  assert.equal(provider.status().executable, '/missing/codex');
});
