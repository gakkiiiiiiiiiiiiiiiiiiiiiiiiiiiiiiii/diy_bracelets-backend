import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import sqlite3 from 'sqlite3';

const require = createRequire(import.meta.url);
const { BraceletRenderService } = require('../dist/bracelet-agent/bracelet-render.service');

const databasePath = resolve(process.env.DATABASE_PATH || join(process.cwd(), 'data', 'diy-bracelets.sqlite'));
const uploadDir = resolve(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'));
const frontendStaticDir = resolve(process.env.FRONTEND_STATIC_DIR || join(process.cwd(), '..', 'frontend', 'src', 'static'));
const db = new sqlite3.Database(databasePath);

function all(sql, params = []) {
  return new Promise((resolveRows, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolveRows(rows)));
}

function run(sql, params = []) {
  return new Promise((resolveRun, reject) => db.run(sql, params, function onRun(error) {
    if (error) reject(error);
    else resolveRun(this);
  }));
}

function close() {
  return new Promise((resolveClose, reject) => db.close((error) => error ? reject(error) : resolveClose()));
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function hydrateMaterial(row) {
  return {
    ...row,
    specs: parseJson(row.specs, []),
    aliases: parseJson(row.aliases, []),
    dominantColors: parseJson(row.dominantColors, []),
    sourceRefs: parseJson(row.sourceRefs, []),
    confidence: parseJson(row.confidence, {}),
    manualOverrides: parseJson(row.manualOverrides, []),
    embedding: parseJson(row.embedding, null),
    assetBundle: parseJson(row.assetBundle, {}),
  };
}

const images = {
  uploadDir,
  async load(sourceRef) {
    let buffer;
    if (/^https?:\/\//i.test(sourceRef)) {
      const response = await fetch(sourceRef, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`无法下载图片 ${response.status}: ${sourceRef}`);
      buffer = Buffer.from(await response.arrayBuffer());
    } else if (sourceRef.startsWith('/uploads/')) {
      buffer = await readFile(resolve(uploadDir, sourceRef.slice('/uploads/'.length)));
    } else if (sourceRef.startsWith('/static/')) {
      buffer = await readFile(resolve(frontendStaticDir, sourceRef.slice('/static/'.length)));
    } else {
      buffer = await readFile(resolve(sourceRef));
    }
    return { buffer, sourceRef, mime: 'image/png' };
  },
};

const renderer = new BraceletRenderService(images);
let generationCount = 0;
let imageCount = 0;
let skippedCount = 0;

try {
  const materialRows = await all('SELECT * FROM materials');
  const materials = new Map(materialRows.map((row) => {
    const material = hydrateMaterial(row);
    return [material.id, material];
  }));
  const generations = await all("SELECT id, candidates FROM agent_generations WHERE status = 'complete' AND candidates IS NOT NULL");

  for (const generation of generations) {
    const candidates = parseJson(generation.candidates, []);
    let complete = true;
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const resolved = (candidate.beads || []).map((bead) => {
        const material = materials.get(bead.materialId);
        return material ? { material, specId: bead.specId } : null;
      }).filter(Boolean);
      if (!resolved.length || resolved.length !== candidate.beads.length) {
        complete = false;
        skippedCount += 1;
        continue;
      }
      candidate.previewImage = await renderer.render(generation.id, index, resolved);
      imageCount += 1;
    }
    if (complete) generationCount += 1;
    await run("UPDATE agent_generations SET candidates = ?, updatedAt = datetime('now') WHERE id = ?", [JSON.stringify(candidates), generation.id]);
  }

  console.log(JSON.stringify({ databasePath, generationCount, imageCount, skippedCount }));
} finally {
  await close();
}
