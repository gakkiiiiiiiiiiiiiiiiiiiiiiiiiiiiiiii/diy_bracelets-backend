const rawBase = process.argv[2] || process.env.API_BASE || '';
const expectedOrigin = process.env.EXPECTED_ORIGIN || '';
const allowInsecure = process.env.ALLOW_INSECURE_SMOKE === 'true';

if (!rawBase) {
  console.error('Usage: API_BASE=https://api.example.com npm run smoke:production');
  process.exit(2);
}

let baseUrl;
try {
  baseUrl = new URL(rawBase);
} catch {
  console.error('API_BASE must be an absolute URL');
  process.exit(2);
}

const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
if (baseUrl.protocol !== 'https:' && !localHosts.has(baseUrl.hostname) && !allowInsecure) {
  console.error('Refusing an insecure non-local API_BASE; use HTTPS');
  process.exit(2);
}

const checks = [
  { path: '/health/live', validate: (body) => body?.status === 'ok' },
  { path: '/health/ready', validate: (body) => body?.status === 'ok' },
  { path: '/api/categories', validate: Array.isArray },
  { path: '/api/materials', validate: Array.isArray },
  { path: '/api/content/home', validate: (body) => body && typeof body === 'object' },
];

const results = [];
for (const check of checks) {
  const requestId = `smoke-${Date.now()}-${results.length}`;
  const response = await fetch(new URL(check.path, baseUrl.origin), {
    headers: {
      'X-Request-Id': requestId,
      ...(expectedOrigin ? { Origin: expectedOrigin } : {}),
    },
    redirect: 'error',
    signal: AbortSignal.timeout(8_000),
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok || !check.validate(body)) {
    throw new Error(`${check.path} failed with HTTP ${response.status}`);
  }
  if (response.headers.get('x-request-id') !== requestId) {
    throw new Error(`${check.path} did not preserve X-Request-Id`);
  }
  if (expectedOrigin && response.headers.get('access-control-allow-origin') !== expectedOrigin) {
    throw new Error(`${check.path} did not allow EXPECTED_ORIGIN`);
  }
  results.push({ path: check.path, status: response.status });
}

console.log(JSON.stringify({ status: 'ok', baseUrl: baseUrl.origin, checks: results }, null, 2));
