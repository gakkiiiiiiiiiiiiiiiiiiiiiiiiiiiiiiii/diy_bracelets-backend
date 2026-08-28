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

  parseTrustProxy(env.TRUST_PROXY);
  const corsOrigins = parseCorsOrigins(env.CORS_ORIGINS);

  if (nodeEnv !== 'production') return env;

  if (!corsOrigins.length) {
    throw new Error('CORS_ORIGINS is required in production');
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
