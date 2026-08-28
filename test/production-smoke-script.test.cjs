const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

function startServer(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function runSmoke(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.resolve(__dirname, '../scripts/smoke-production.mjs')], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('production smoke verifies API, public static assets, and admin security headers', async () => {
  const expectedOrigin = 'https://admin.example.test';
  const api = await startServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('X-Request-Id', request.headers['x-request-id'] || '');
    response.setHeader('Access-Control-Allow-Origin', expectedOrigin);
    if (request.url === '/api/categories' || request.url === '/api/materials') response.end('[]');
    else response.end('{"status":"ok"}');
  });
  const staticSite = await startServer((request, response) => {
    if (request.url === '/health') response.end('ok\n');
    else {
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      response.setHeader('Cache-Control', 'public, max-age=86400');
      response.end('{}');
    }
  });
  const admin = await startServer((request, response) => {
    if (request.url === '/health') response.end('ok\n');
    else {
      response.setHeader('X-Frame-Options', 'DENY');
      response.setHeader('Cache-Control', 'no-store');
      response.end('<!doctype html>');
    }
  });

  try {
    const result = await runSmoke({
      API_BASE: api.origin,
      STATIC_BASE: staticSite.origin,
      ADMIN_BASE: admin.origin,
      EXPECTED_ORIGIN: expectedOrigin,
    });
    assert.equal(result.code, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'ok');
    assert.equal(report.requestCount, 9);
    assert.deepEqual(report.checks.map((item) => item.target), [
      'api', 'api', 'api', 'api', 'api', 'static', 'static', 'admin', 'admin',
    ]);
  } finally {
    await Promise.all([closeServer(api.server), closeServer(staticSite.server), closeServer(admin.server)]);
  }
});
