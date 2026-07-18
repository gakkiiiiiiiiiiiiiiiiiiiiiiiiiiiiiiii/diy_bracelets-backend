const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const sharp = require('sharp');
const { BraceletRenderService } = require('../dist/bracelet-agent/bracelet-render.service');

function material(id, color, transparency = '通透') {
  return {
    id,
    name: id,
    image: `memory://${id}.png`,
    categoryId: 'crystal',
    specs: [{ specId: `${id}-8mm`, size: 8, price: 5 }],
    status: 'published',
    isAvailable: true,
    crystalFamily: id,
    aliases: [],
    dominantColors: [color],
    transparency,
    pattern: '天然纹理',
    inclusions: '',
    sourceRefs: [],
    confidence: {},
    generatedBy: 'manual',
    manualOverrides: [],
    embedding: null,
    assetBundle: null,
  };
}

async function beadPng(color) {
  return sharp(Buffer.from(`<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="g" cx="30%" cy="23%"><stop stop-color="#fff"/><stop offset=".22" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".82"/></radialGradient></defs>
    <circle cx="128" cy="128" r="104" fill="url(#g)"/>
  </svg>`)).png().toBuffer();
}

test('renders a photography-style ordered bracelet as a transparent 1024px product image', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bracelet-render-'));
  try {
    const colors = { red: '#cc5264', blue: '#6ea5ca', green: '#75a989', gold: '#b88a3c' };
    const buffers = Object.fromEntries(await Promise.all(Object.entries(colors).map(async ([id, color]) => [id, await beadPng(color)])));
    const images = {
      uploadDir: dir,
      load: async (sourceRef) => ({
        buffer: buffers[sourceRef.match(/^memory:\/\/(.+)\.png$/)?.[1]],
        mime: 'image/png',
        sourceRef,
      }),
    };
    const renderer = new BraceletRenderService(images);
    const materials = Object.entries(colors).map(([id, color]) => material(id, color));
    const ordered = Array.from({ length: 20 }, (_, index) => {
      const item = materials[index % materials.length];
      return { material: item, specId: item.specs[0].specId };
    });

    const publicPath = await renderer.render('test-generation', 2, ordered);
    assert.equal(publicPath, '/uploads/agent/test-generation/2.png');
    const output = await readFile(join(dir, 'agent/test-generation/2.png'));
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.width, 1024);
    assert.equal(metadata.height, 1024);
    assert.equal(metadata.hasAlpha, true);

    const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x, y) => data[(y * info.width + x) * 4 + 3];
    const rgbAt = (x, y) => data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 3);
    assert.equal(alphaAt(0, 0), 0);
    assert.equal(alphaAt(1023, 0), 0);
    assert.equal(alphaAt(0, 1023), 0);
    assert.equal(alphaAt(1023, 1023), 0);
    assert.ok(alphaAt(512, 510) < 20, 'the bracelet center remains transparent');

    // 顺序从顶部开始顺时针：0/5/10/15 号珠分别落在上、右、下、左。
    const top = rgbAt(512, 321);
    const right = rgbAt(760, 510);
    const bottom = rgbAt(512, 699);
    const left = rgbAt(264, 510);
    assert.ok(top[0] > top[1] && top[0] > top[2], 'ordered bead 0 is rendered at the top');
    assert.ok(right[2] > right[0], 'ordered bead 5 is rendered at the right');
    assert.ok(bottom[1] > bottom[0], 'ordered bead 10 is rendered at the bottom');
    assert.ok(left[0] > left[2], 'ordered bead 15 is rendered at the left');

    let opaque = 0;
    let minX = info.width;
    let maxX = 0;
    let minY = info.height;
    let maxY = 0;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        if (alphaAt(x, y) <= 24) continue;
        opaque += 1;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    assert.ok(opaque / (info.width * info.height) > 0.07, 'the product is large enough for a cover image');
    assert.ok(maxX - minX > 480, 'the bracelet fills the product frame horizontally');
    assert.ok(maxY - minY > 360, 'the perspective bracelet has visible depth');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
