const NODE_ENV_VALUES = new Set(['development', 'test', 'production']);

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function positiveInteger(value: unknown, fallback: number, name: string): number {
  const candidate = text(value);
  if (!candidate) return fallback;
  const parsed = Number(candidate);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function parseBoolean(value: unknown, fallback = false): boolean {
  const candidate = text(value).toLowerCase();
  if (!candidate) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(candidate)) return true;
  if (['0', 'false', 'no', 'off'].includes(candidate)) return false;
  throw new Error(`Invalid boolean value: ${candidate}`);
}

export function parseCorsOrigins(value: unknown): string[] {
  const origins = text(value)
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  for (const origin of origins) {
    if (origin === '*') throw new Error('CORS_ORIGINS must not contain *');
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error(`CORS_ORIGINS must contain origins only: ${origin}`);
    }
  }

  return [...new Set(origins)];
}

export function parseTrustProxy(value: unknown): false | number | string {
  const candidate = text(value);
  if (!candidate || candidate.toLowerCase() === 'false') return false;
  if (/^[1-9]\d*$/.test(candidate)) return Number(candidate);
  if (candidate.toLowerCase() === 'true') {
    throw new Error('TRUST_PROXY=true is too broad; use a hop count or named subnet such as loopback');
  }
  return candidate;
}

export function validateEnvironment(raw: Record<string, unknown>): Record<string, unknown> {
  const env = { ...raw };
  const nodeEnv = text(env.NODE_ENV) || 'development';
  if (!NODE_ENV_VALUES.has(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  env.NODE_ENV = nodeEnv;
  env.PORT = positiveInteger(env.PORT, 3008, 'PORT');
  env.RATE_LIMIT_TTL_MS = positiveInteger(env.RATE_LIMIT_TTL_MS, 60_000, 'RATE_LIMIT_TTL_MS');
  env.RATE_LIMIT_MAX = positiveInteger(env.RATE_LIMIT_MAX, 120, 'RATE_LIMIT_MAX');
  env.DB_CONNECT_RETRIES = positiveInteger(env.DB_CONNECT_RETRIES, 10, 'DB_CONNECT_RETRIES');
  env.DB_CONNECT_RETRY_DELAY_MS = positiveInteger(
    env.DB_CONNECT_RETRY_DELAY_MS,
    3_000,
    'DB_CONNECT_RETRY_DELAY_MS',
  );
  env.DB_CONNECTION_TIMEOUT_MS = positiveInteger(
    env.DB_CONNECTION_TIMEOUT_MS,
    5_000,
    'DB_CONNECTION_TIMEOUT_MS',
  );
  env.DB_STATEMENT_TIMEOUT_MS = positiveInteger(
    env.DB_STATEMENT_TIMEOUT_MS,
    15_000,
    'DB_STATEMENT_TIMEOUT_MS',
  );
  env.DB_POOL_MAX = positiveInteger(env.DB_POOL_MAX, 10, 'DB_POOL_MAX');
  env.ADMIN_SESSION_TTL_SECONDS = positiveInteger(
    env.ADMIN_SESSION_TTL_SECONDS,
    8 * 60 * 60,
    'ADMIN_SESSION_TTL_SECONDS',
  );
  env.USER_SESSION_TTL_SECONDS = positiveInteger(
    env.USER_SESSION_TTL_SECONDS,
    30 * 24 * 60 * 60,
    'USER_SESSION_TTL_SECONDS',
  );
  const designProcessVideoEnabled = parseBoolean(env.DESIGN_PROCESS_VIDEO_ENABLED, false);
  env.DESIGN_PROCESS_VIDEO_ENABLED = designProcessVideoEnabled;
  const braceletAgentEnabled = parseBoolean(env.BRACELET_AGENT_ENABLED, false);
  const aiExtractionEnabled = parseBoolean(env.AI_EXTRACTION_ENABLED, false);
  const aiTasksSingleInstance = parseBoolean(env.AI_TASKS_SINGLE_INSTANCE, false);
  env.BRACELET_AGENT_ENABLED = braceletAgentEnabled;
  env.AI_EXTRACTION_ENABLED = aiExtractionEnabled;
  env.AI_TASKS_SINGLE_INSTANCE = aiTasksSingleInstance;

  parseTrustProxy(env.TRUST_PROXY);
  const corsOrigins = parseCorsOrigins(env.CORS_ORIGINS);
  const adminCookieSameSite = text(env.ADMIN_COOKIE_SAME_SITE).toLowerCase() || 'strict';
  if (!['strict', 'lax', 'none'].includes(adminCookieSameSite)) {
    throw new Error('ADMIN_COOKIE_SAME_SITE must be strict, lax, or none');
  }
  env.ADMIN_COOKIE_SAME_SITE = adminCookieSameSite;

  const wechatAppId = text(env.WECHAT_APP_ID);
  const wechatAppSecret = text(env.WECHAT_APP_SECRET);
  if (Boolean(wechatAppId) !== Boolean(wechatAppSecret)) {
    throw new Error('WECHAT_APP_ID and WECHAT_APP_SECRET must be configured together');
  }

  const uploadStorageMode = text(env.UPLOAD_STORAGE_MODE).toLowerCase() || 'ephemeral';
  if (!['ephemeral', 'persistent'].includes(uploadStorageMode)) {
    throw new Error('UPLOAD_STORAGE_MODE must be ephemeral or persistent');
  }
  env.UPLOAD_STORAGE_MODE = uploadStorageMode;

  if (designProcessVideoEnabled) {
    const renderUrl = text(env.VIDEO_WEB_RENDER_URL);
    let parsedRenderUrl: URL;
    try {
      parsedRenderUrl = new URL(renderUrl);
    } catch {
      throw new Error('VIDEO_WEB_RENDER_URL must be an absolute HTTP(S) URL when video rendering is enabled');
    }
    if (!['http:', 'https:'].includes(parsedRenderUrl.protocol)) {
      throw new Error('VIDEO_WEB_RENDER_URL must be an absolute HTTP(S) URL when video rendering is enabled');
    }
  }

  const databaseType = text(env.DB_TYPE) || text(env.REMOTE_DB_TYPE) || 'postgres';
  const databaseSslMode = text(env.DB_SSL_MODE).toLowerCase() || 'disable';
  if (!['disable', 'require', 'verify-full'].includes(databaseSslMode)) {
    throw new Error('DB_SSL_MODE must be disable, require, or verify-full');
  }
  if (databaseType !== 'postgres' && databaseSslMode !== 'disable') {
    throw new Error('DB_SSL_MODE is currently supported for PostgreSQL only');
  }
  if (databaseSslMode === 'verify-full' && !text(env.DB_SSL_CA_PATH) && !text(env.DB_SSL_CA)) {
    throw new Error('DB_SSL_CA_PATH or DB_SSL_CA is required when DB_SSL_MODE=verify-full');
  }
  env.DB_SSL_MODE = databaseSslMode;

  if (nodeEnv !== 'production') return env;

  if (!corsOrigins.length) {
    throw new Error('CORS_ORIGINS is required in production');
  }
  if (!parseBoolean(env.CORS_ALLOW_CREDENTIALS, false)) {
    throw new Error('CORS_ALLOW_CREDENTIALS=true is required for admin sessions in production');
  }

  if (!/^wx[a-f0-9]{16}$/i.test(wechatAppId)) {
    throw new Error('Production requires a valid WECHAT_APP_ID');
  }
  if (!/^[a-f0-9]{32}$/i.test(wechatAppSecret)) {
    throw new Error('Production requires a valid WECHAT_APP_SECRET');
  }
  if (uploadStorageMode !== 'persistent') {
    throw new Error('Production requires UPLOAD_STORAGE_MODE=persistent and a durable UPLOAD_DIR mount');
  }
  if ((braceletAgentEnabled || aiExtractionEnabled) && !aiTasksSingleInstance) {
    throw new Error('Production AI tasks require AI_TASKS_SINGLE_INSTANCE=true and exactly one backend task executor');
  }
  if (aiExtractionEnabled && !text(env.OPENAI_API_KEY)) {
    throw new Error('AI_EXTRACTION_ENABLED=true requires OPENAI_API_KEY');
  }
  const adminUsername = text(env.ADMIN_USERNAME);
  const adminPasswordHash = text(env.ADMIN_PASSWORD_HASH);
  if (!/^[A-Za-z0-9._@-]{3,64}$/.test(adminUsername)) {
    throw new Error('ADMIN_USERNAME must be 3-64 safe characters');
  }
  if (!/^scrypt\.\d+\.\d+\.\d+\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{40,}$/.test(adminPasswordHash)) {
    throw new Error('ADMIN_PASSWORD_HASH must be generated by npm run auth:hash-password');
  }
  const secureAdminCookie = parseBoolean(env.ADMIN_COOKIE_SECURE, true);
  if (!secureAdminCookie) {
    throw new Error('ADMIN_COOKIE_SECURE must stay enabled in production');
  }
  if (adminCookieSameSite === 'none' && !secureAdminCookie) {
    throw new Error('ADMIN_COOKIE_SAME_SITE=none requires ADMIN_COOKIE_SECURE=true');
  }

  const databasePath = text(env.DATABASE_PATH);
  const dbHost = text(env.DB_HOST) || text(env.REMOTE_DB_HOST);
  if (!databasePath && !dbHost) {
    throw new Error('Production requires DB_HOST or DATABASE_PATH');
  }

  if (databasePath && !parseBoolean(env.ALLOW_SQLITE_PRODUCTION, false)) {
    throw new Error('SQLite production use requires ALLOW_SQLITE_PRODUCTION=true');
  }

  if (dbHost) {
    const username = text(env.DB_USERNAME) || text(env.REMOTE_DB_USERNAME);
    const password = text(env.DB_PASSWORD) || text(env.REMOTE_DB_PASSWORD);
    const database = text(env.DB_DATABASE) || text(env.REMOTE_DB_DATABASE);
    if (!username || !password || !database) {
      throw new Error('Production database requires username, password, and database name');
    }
    if (['postgres', 'password', 'changeme'].includes(password.toLowerCase())) {
      throw new Error('Production database password is using an unsafe default');
    }
  }

  return env;
}
