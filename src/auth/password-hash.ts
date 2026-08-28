import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 32;
const DEFAULT_N = 16_384;
const DEFAULT_R = 8;
const DEFAULT_P = 1;

export function hashAdminPassword(password: string, salt = randomBytes(16)): string {
  if (password.length < 12 || password.length > 256) {
    throw new Error('Admin password must be 12-256 characters');
  }
  const derived = scryptSync(password, salt, KEY_LENGTH, {
    N: DEFAULT_N,
    r: DEFAULT_R,
    p: DEFAULT_P,
    maxmem: 64 * 1024 * 1024,
  });
  return [
    'scrypt',
    DEFAULT_N,
    DEFAULT_R,
    DEFAULT_P,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('.');
}

export function verifyAdminPassword(password: string, encoded: string): boolean {
  if (password.length > 256) return false;
  const [algorithm, nText, rText, pText, saltText, expectedText, ...rest] = encoded.split('.');
  if (algorithm !== 'scrypt' || rest.length || !saltText || !expectedText) return false;
  const N = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  if (N !== DEFAULT_N || r !== DEFAULT_R || p !== DEFAULT_P) return false;

  try {
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(expectedText, 'base64url');
    if (salt.length < 16 || expected.length !== KEY_LENGTH) return false;
    const actual = scryptSync(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
