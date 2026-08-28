import { randomBytes, scryptSync } from 'node:crypto';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const password = Buffer.concat(chunks).toString('utf8').replace(/[\r\n]+$/, '');
if (password.length < 12 || password.length > 256) {
  console.error('Admin password must be 12-256 characters');
  process.exit(1);
}

const salt = randomBytes(16);
const derived = scryptSync(password, salt, 32, {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
});
process.stdout.write(`scrypt.16384.8.1.${salt.toString('base64url')}.${derived.toString('base64url')}\n`);
