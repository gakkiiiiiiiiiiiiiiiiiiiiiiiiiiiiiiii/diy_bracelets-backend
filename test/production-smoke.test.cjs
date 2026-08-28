const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const net = require('node:net');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const sqlite3 = require('sqlite3');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForReady(baseUrl, child, output) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`production server exited early (${child.exitCode})\n${output()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health/ready`);
      if (response.ok) return response;
    } catch {
      // The process may still be applying its first migration.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`production server did not become ready\n${output()}`);
}

function migrationNames(databasePath) {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(databasePath);
    database.all('select name from app_migrations order by id', (error, rows) => {
      database.close();
      if (error) reject(error);
      else resolve(rows.map((row) => row.name));
    });
  });
}

test('production server migrates an empty database and enforces HTTP safeguards', async () => {
  const runtimeDir = mkdtempSync(join(tmpdir(), 'diy-bracelets-production-'));
  const databasePath = join(runtimeDir, 'app.sqlite');
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let logs = '';
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      DB_HOST: '',
      REMOTE_DB_HOST: '',
      DATABASE_PATH: databasePath,
      ALLOW_SQLITE_PRODUCTION: 'true',
      UPLOAD_DIR: join(runtimeDir, 'uploads'),
      CORS_ORIGINS: 'https://app.example.com',
      TRUST_PROXY: 'false',
      RATE_LIMIT_MAX: '100',
      DB_CONNECT_RETRIES: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const append = (chunk) => {
    logs = `${logs}${String(chunk)}`.slice(-20_000);
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);

  try {
    const ready = await waitForReady(baseUrl, child, () => logs);
    const readyBody = await ready.json();
    assert.equal(readyBody.status, 'ok');
    assert.equal(readyBody.info.database.status, 'up');
    assert.equal(readyBody.info.storage.status, 'up');

    const allowed = await fetch(`${baseUrl}/health/live`, {
      headers: { Origin: 'https://app.example.com' },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.example.com');
    assert.ok(allowed.headers.get('x-request-id'));
    assert.equal(allowed.headers.get('x-content-type-options'), 'nosniff');

    const denied = await fetch(`${baseUrl}/health/live`, {
      headers: { Origin: 'https://evil.example.com' },
    });
    assert.equal(denied.status, 403);

    const invalidBody = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'invalid', name: 'Invalid', unexpected: true }),
    });
    assert.equal(invalidBody.status, 400);

    assert.deepEqual(
      await migrationNames(databasePath),
      ['InitialSchema1787884800000'],
    );
  } finally {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
    rmSync(runtimeDir, { recursive: true, force: true });
  }
});
