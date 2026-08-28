const rawApiBase = process.argv[2] || process.env.API_BASE || '';
const rawStaticBase = process.env.STATIC_BASE || '';
const rawAdminBase = process.env.ADMIN_BASE || '';
const expectedOrigin = process.env.EXPECTED_ORIGIN || '';
const allowInsecure = process.env.ALLOW_INSECURE_SMOKE === 'true';
const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);

function parseBase(raw, name, required = false) {
  if (!raw) {
    if (required) {
      console.error(`Usage: ${name}=https://example.com npm run smoke:production`);
      process.exit(2);
    }
    return null;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    console.error(`${name} must be an absolute URL`);
    process.exit(2);
  }
  if (url.protocol !== 'https:' && !localHosts.has(url.hostname) && !allowInsecure) {
    console.error(`Refusing an insecure non-local ${name}; use HTTPS`);
    process.exit(2);
  }
  if (url.username || url.password || url.search || url.hash) {
    console.error(`${name} must not contain credentials, query parameters, or fragments`);
    process.exit(2);
  }
  return url;
}

const apiBase = parseBase(rawApiBase, 'API_BASE', true);
const staticBase = parseBase(rawStaticBase, 'STATIC_BASE');
const adminBase = parseBase(rawAdminBase, 'ADMIN_BASE');
const staticAssetPath = process.env.STATIC_ASSET_PATH || '/static/materials/reference-crystals/manifest.json';
if (!/^\/static\/[A-Za-z0-9._/-]+$/.test(staticAssetPath) || staticAssetPath.includes('..')) {
  console.error('STATIC_ASSET_PATH must be a safe path below /static/');
  process.exit(2);
}

async function request(base, path, options = {}) {
  const response = await fetch(new URL(path, base.origin), {
    headers: options.headers,
    redirect: 'error',
    signal: AbortSignal.timeout(8_000),
  });
  const contentType = response.headers.get('content-type') || '';
  const body = options.json && contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok || (options.validate && !options.validate(body, response))) {
    throw new Error(`${options.target || base.origin}${path} failed with HTTP ${response.status}`);
  }
  return { response, body };
}

const results = [];
const apiChecks = [
  { path: '/health/live', validate: (body) => body?.status === 'ok' },
  { path: '/health/ready', validate: (body) => body?.status === 'ok' },
  { path: '/api/categories', validate: Array.isArray },
  { path: '/api/materials', validate: Array.isArray },
  { path: '/api/shop-products', validate: (body) => Array.isArray(body?.items) && body.items.length > 0 },
  { path: '/api/content/home', validate: (body) => body && typeof body === 'object' },
];

for (const check of apiChecks) {
  const requestId = `smoke-${Date.now()}-${results.length}`;
  const { response } = await request(apiBase, check.path, {
    target: 'api',
    json: true,
    validate: check.validate,
    headers: {
      'X-Request-Id': requestId,
      ...(expectedOrigin ? { Origin: expectedOrigin } : {}),
    },
  });
  if (response.headers.get('x-request-id') !== requestId) {
    throw new Error(`${check.path} did not preserve X-Request-Id`);
  }
  if (expectedOrigin && response.headers.get('access-control-allow-origin') !== expectedOrigin) {
    throw new Error(`${check.path} did not allow EXPECTED_ORIGIN`);
  }
  results.push({ target: 'api', path: check.path, status: response.status });
}

if (staticBase) {
  const health = await request(staticBase, '/health', {
    target: 'static',
    validate: (body) => body.trim() === 'ok',
  });
  results.push({ target: 'static', path: '/health', status: health.response.status });

  const asset = await request(staticBase, staticAssetPath, {
    target: 'static',
    validate: (_body, response) =>
      response.headers.get('access-control-allow-origin') === '*' &&
      response.headers.get('cross-origin-resource-policy') === 'cross-origin' &&
      /max-age=\d+/.test(response.headers.get('cache-control') || ''),
  });
  results.push({ target: 'static', path: staticAssetPath, status: asset.response.status });
}

if (adminBase) {
  const health = await request(adminBase, '/health', {
    target: 'admin',
    validate: (body) => body.trim() === 'ok',
  });
  results.push({ target: 'admin', path: '/health', status: health.response.status });

  const root = await request(adminBase, '/', {
    target: 'admin',
    validate: (_body, response) =>
      response.headers.get('x-frame-options') === 'DENY' &&
      response.headers.get('cache-control') === 'no-store',
  });
  results.push({ target: 'admin', path: '/', status: root.response.status });
}

console.log(JSON.stringify({
  status: 'ok',
  targets: {
    api: apiBase.origin,
    ...(staticBase ? { static: staticBase.origin } : {}),
    ...(adminBase ? { admin: adminBase.origin } : {}),
  },
  checks: results,
  requestCount: results.length,
}, null, 2));
