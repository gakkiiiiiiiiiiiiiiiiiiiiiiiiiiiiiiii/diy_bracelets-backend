const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCorsOrigins,
  parseTrustProxy,
  validateEnvironment,
} = require('../dist/config/environment.js');

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
      DB_HOST: 'database',
      DB_USERNAME: 'postgres',
      DB_PASSWORD: 'postgres',
      DB_DATABASE: 'bracelets',
    }),
    /unsafe default/,
  );
});

test('production configuration accepts explicit secure settings', () => {
  const result = validateEnvironment({
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://app.example.com, https://admin.example.com/',
    TRUST_PROXY: '1',
    DB_HOST: 'database',
    DB_USERNAME: 'bracelets',
    DB_PASSWORD: 'a-long-random-password',
    DB_DATABASE: 'bracelets',
  });

  assert.equal(result.NODE_ENV, 'production');
  assert.equal(result.PORT, 3008);
  assert.deepEqual(
    parseCorsOrigins(result.CORS_ORIGINS),
    ['https://app.example.com', 'https://admin.example.com'],
  );
  assert.equal(parseTrustProxy(result.TRUST_PROXY), 1);
});

test('trust proxy rejects the unsafe catch-all boolean setting', () => {
  assert.throws(() => parseTrustProxy('true'), /too broad/);
});
