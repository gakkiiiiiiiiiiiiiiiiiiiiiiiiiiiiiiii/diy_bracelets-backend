const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCorsOrigins,
  parseTrustProxy,
  validateEnvironment,
} = require('../dist/config/environment.js');
const { hashAdminPassword } = require('../dist/auth/password-hash.js');

const secureAuth = {
  CORS_ALLOW_CREDENTIALS: 'true',
  ADMIN_USERNAME: 'production-admin',
  ADMIN_PASSWORD_HASH: hashAdminPassword('a-secure-admin-password'),
  WECHAT_APP_ID: 'wx1234567890abcdef',
  WECHAT_APP_SECRET: '1234567890abcdef1234567890abcdef',
  UPLOAD_STORAGE_MODE: 'persistent',
};

test('production configuration rejects an open or missing CORS policy', () => {
  const base = {
    NODE_ENV: 'production',
    DB_HOST: 'database',
    DB_USERNAME: 'app',
    DB_PASSWORD: 'a-long-random-password',
    DB_DATABASE: 'bracelets',
  };

  assert.throws(() => validateEnvironment(base), /CORS_ORIGINS is required/);
  assert.throws(
    () => validateEnvironment({ ...base, CORS_ORIGINS: '*' }),
    /must not contain \*/,
  );
});

test('production configuration rejects unsafe database defaults', () => {
  assert.throws(
    () => validateEnvironment({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://admin.example.com',
      ...secureAuth,
      DB_HOST: 'database',
      DB_USERNAME: 'postgres',
      DB_PASSWORD: 'postgres',
      DB_DATABASE: 'bracelets',
    }),
    /unsafe default/,
  );
});

test('production configuration requires WeChat credentials and durable upload storage', () => {
  const base = {
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://admin.example.com',
    CORS_ALLOW_CREDENTIALS: 'true',
    ADMIN_USERNAME: secureAuth.ADMIN_USERNAME,
    ADMIN_PASSWORD_HASH: secureAuth.ADMIN_PASSWORD_HASH,
    DB_HOST: 'database',
    DB_USERNAME: 'app',
    DB_PASSWORD: 'a-long-random-password',
    DB_DATABASE: 'bracelets',
  };

  assert.throws(() => validateEnvironment(base), /valid WECHAT_APP_ID/);
  assert.throws(
    () => validateEnvironment({
      ...base,
      WECHAT_APP_ID: secureAuth.WECHAT_APP_ID,
      WECHAT_APP_SECRET: secureAuth.WECHAT_APP_SECRET,
    }),
    /UPLOAD_STORAGE_MODE=persistent/,
  );
});

test('production configuration accepts explicit secure settings', () => {
  const result = validateEnvironment({
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://app.example.com, https://admin.example.com/',
    ...secureAuth,
    TRUST_PROXY: '1',
    DB_HOST: 'database',
    DB_USERNAME: 'bracelets',
    DB_PASSWORD: 'a-long-random-password',
    DB_DATABASE: 'bracelets',
  });

  assert.equal(result.NODE_ENV, 'production');
  assert.equal(result.PORT, 3008);
  assert.equal(result.DB_POOL_MAX, 10);
  assert.equal(result.DB_SSL_MODE, 'disable');
  assert.equal(result.UPLOAD_STORAGE_MODE, 'persistent');
  assert.equal(result.BRACELET_AGENT_ENABLED, false);
  assert.equal(result.AI_EXTRACTION_ENABLED, false);
  assert.deepEqual(
    parseCorsOrigins(result.CORS_ORIGINS),
    ['https://app.example.com', 'https://admin.example.com'],
  );
  assert.equal(parseTrustProxy(result.TRUST_PROXY), 1);
});

test('production AI tasks require explicit single-instance execution and provider credentials', () => {
  const base = {
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://admin.example.com',
    ...secureAuth,
    DB_HOST: 'database',
    DB_USERNAME: 'bracelets',
    DB_PASSWORD: 'a-long-random-password',
    DB_DATABASE: 'bracelets',
  };

  assert.throws(
    () => validateEnvironment({ ...base, BRACELET_AGENT_ENABLED: 'true' }),
    /AI_TASKS_SINGLE_INSTANCE=true/,
  );
  assert.throws(
    () => validateEnvironment({ ...base, AI_EXTRACTION_ENABLED: 'true', AI_TASKS_SINGLE_INSTANCE: 'true' }),
    /OPENAI_API_KEY/,
  );
  const result = validateEnvironment({
    ...base,
    AI_EXTRACTION_ENABLED: 'true',
    AI_TASKS_SINGLE_INSTANCE: 'true',
    OPENAI_API_KEY: 'test-provider-key',
  });
  assert.equal(result.AI_EXTRACTION_ENABLED, true);
  assert.equal(result.AI_TASKS_SINGLE_INSTANCE, true);
});

test('database TLS configuration requires a verified CA for verify-full', () => {
  const base = {
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://admin.example.com',
    ...secureAuth,
    DB_HOST: 'database.example.com',
    DB_USERNAME: 'bracelets',
    DB_PASSWORD: 'a-long-random-password',
    DB_DATABASE: 'bracelets',
  };

  assert.throws(
    () => validateEnvironment({ ...base, DB_SSL_MODE: 'verify-full' }),
    /DB_SSL_CA_PATH or DB_SSL_CA is required/,
  );
  const result = validateEnvironment({
    ...base,
    DB_SSL_MODE: 'verify-full',
    DB_SSL_CA: '-----BEGIN CERTIFICATE-----\\nexample\\n-----END CERTIFICATE-----',
  });
  assert.equal(result.DB_SSL_MODE, 'verify-full');
});

test('trust proxy rejects the unsafe catch-all boolean setting', () => {
  assert.throws(() => parseTrustProxy('true'), /too broad/);
});

test('production video rendering is opt-in and requires an absolute render URL', () => {
  const base = {
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://admin.example.com',
    ...secureAuth,
    DB_HOST: 'database',
    DB_USERNAME: 'app',
    DB_PASSWORD: 'a-long-random-password',
    DB_DATABASE: 'bracelets',
    DESIGN_PROCESS_VIDEO_ENABLED: 'true',
  };

  assert.throws(() => validateEnvironment(base), /VIDEO_WEB_RENDER_URL/);
  assert.throws(
    () => validateEnvironment({
      ...base,
      VIDEO_WEB_RENDER_URL: 'https://app.example.com/#/pages/design/design',
    }),
    /AI_TASKS_SINGLE_INSTANCE=true/,
  );
  const result = validateEnvironment({
    ...base,
    VIDEO_WEB_RENDER_URL: 'https://app.example.com/#/pages/design/design',
    AI_TASKS_SINGLE_INSTANCE: 'true',
  });
  assert.equal(result.DESIGN_PROCESS_VIDEO_ENABLED, true);
});
