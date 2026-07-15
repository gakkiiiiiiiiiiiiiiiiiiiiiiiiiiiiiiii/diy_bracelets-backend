const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { ImageAssetsService } = require('../dist/ai/image-assets.service');

function service() {
  const root = path.join(os.tmpdir(), 'diy-bracelets-image-tests');
  const values = { UPLOAD_DIR: root, EXTRACTION_SOURCE_DIR: root, EXTRACTION_OUTPUT_DIR: path.join(root, 'out'), FRONTEND_STATIC_DIR: root };
  return new ImageAssetsService({ get: (key, fallback) => values[key] || fallback });
}

test('chroma-key conversion produces a validated transparent 1024 PNG', async () => {
  const images = service();
  const input = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#00ff00' } })
    .composite([{ input: Buffer.from('<svg width="500" height="500"><circle cx="250" cy="250" r="220" fill="#8d78b4"/></svg>'), left: 262, top: 262 }])
    .png().toBuffer();
  const output = await images.removeChromaKey(input, 'green');
  const validation = await images.validateTransparentBead(output);
  assert.equal(validation.valid, true, validation.reasons.join(', '));
  assert.ok(validation.coverage > 0.1 && validation.coverage < 0.4);
});

test('perceptual hash and hamming distance are deterministic', async () => {
  const images = service();
  const input = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#8844aa' } }).png().toBuffer();
  const a = await images.perceptualHash(input);
  const b = await images.perceptualHash(input);
  assert.equal(a, b);
  assert.equal(images.hammingDistance(a, b), 0);
});
