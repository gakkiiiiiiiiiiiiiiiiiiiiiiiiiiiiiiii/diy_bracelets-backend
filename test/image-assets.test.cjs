const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
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

test('image loading rejects remote URLs and upload path traversal', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'diy-bracelets-image-boundary-'));
  const uploadDir = path.join(root, 'uploads');
  const outsideImage = path.join(root, 'outside.png');
  const values = {
    UPLOAD_DIR: uploadDir,
    EXTRACTION_SOURCE_DIR: uploadDir,
    EXTRACTION_OUTPUT_DIR: path.join(uploadDir, 'out'),
    FRONTEND_STATIC_DIR: path.join(root, 'static'),
  };
  const images = new ImageAssetsService({ get: (key, fallback) => values[key] || fallback });
  writeFileSync(outsideImage, await sharp({
    create: { width: 16, height: 16, channels: 3, background: '#ffffff' },
  }).png().toBuffer());

  try {
    await assert.rejects(() => images.load('http://127.0.0.1/private.png'), /先通过后台上传/);
    await assert.rejects(() => images.load('/uploads/../outside.png'), /不在允许目录/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('image loading verifies actual file content instead of trusting an extension', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'diy-bracelets-image-content-'));
  const values = {
    UPLOAD_DIR: root,
    EXTRACTION_SOURCE_DIR: root,
    EXTRACTION_OUTPUT_DIR: path.join(root, 'out'),
    FRONTEND_STATIC_DIR: root,
  };
  const images = new ImageAssetsService({ get: (key, fallback) => values[key] || fallback });
  writeFileSync(path.join(root, 'fake.png'), Buffer.from('<html>not an image</html>'));

  try {
    await assert.rejects(() => images.load('/uploads/fake.png'), /图片内容无效/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
