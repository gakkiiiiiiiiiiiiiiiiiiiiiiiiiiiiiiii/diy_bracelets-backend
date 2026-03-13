import { readFile } from 'node:fs/promises';
import path from 'node:path';

const API_BASE = (process.env.API_BASE || 'http://localhost:3008').replace(/\/$/, '');
const ROOT = path.resolve(process.cwd(), '..');
const TEXTURE_DIR = path.join(ROOT, 'frontend', 'static', 'textures');

const categories = [
  { id: 'white', name: '白水晶' },
  { id: 'purple', name: '紫水晶' },
  { id: 'yellow', name: '黄水晶' },
  { id: 'pink', name: '粉水晶' },
  { id: 'other', name: '其他' },
];

const materials = [
  {
    id: 'm1',
    name: '净体白水晶',
    file: 'crystal-white.png',
    categoryId: 'white',
    specs: [{ size: 6, price: 3 }, { size: 8, price: 5 }, { size: 10, price: 10 }],
  },
  {
    id: 'm2',
    name: '奶白晶',
    file: 'crystal-milky.png',
    categoryId: 'white',
    specs: [{ size: 6, price: 4 }, { size: 8, price: 6 }],
  },
  {
    id: 'm3',
    name: '薰衣草紫水晶',
    file: 'crystal-lavender.png',
    categoryId: 'purple',
    specs: [{ size: 6, price: 5 }, { size: 10, price: 12 }],
  },
  {
    id: 'm4',
    name: '深紫水晶',
    file: 'crystal-deep-purple.png',
    categoryId: 'purple',
    specs: [{ size: 8, price: 8 }, { size: 10, price: 15 }],
  },
  {
    id: 'm5',
    name: '黄水晶',
    file: 'crystal-yellow.png',
    categoryId: 'yellow',
    specs: [{ size: 6, price: 4 }, { size: 8, price: 7 }],
  },
  {
    id: 'm6',
    name: '粉水晶',
    file: 'crystal-pink.png',
    categoryId: 'pink',
    specs: [{ size: 6, price: 3 }, { size: 8, price: 5 }, { size: 10, price: 9 }],
  },
  {
    id: 'm7',
    name: '草莓晶',
    file: 'crystal-strawberry.png',
    categoryId: 'pink',
    specs: [{ size: 8, price: 6 }],
  },
  {
    id: 'm8',
    name: '玛瑙',
    file: 'crystal-agate.png',
    categoryId: 'other',
    specs: [{ size: 6, price: 2 }, { size: 10, price: 8 }],
  },
];

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${url} failed: ${response.status} ${await response.text()}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function uploadTexture(fileName) {
  const filePath = path.join(TEXTURE_DIR, fileName);
  const buffer = await readFile(filePath);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'image/png' }), fileName);

  const response = await fetch(`${API_BASE}/api/materials/upload`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw new Error(`UPLOAD ${fileName} failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function ensureCategories() {
  const existing = await requestJson(`${API_BASE}/api/categories`);
  const existingMap = new Map(existing.map((item) => [item.id, item]));

  for (const category of categories) {
    if (!existingMap.has(category.id)) {
      await requestJson(`${API_BASE}/api/categories`, {
        method: 'POST',
        body: JSON.stringify(category),
      });
      console.log(`created category ${category.id}`);
      continue;
    }

    const row = existingMap.get(category.id);
    if (row.name !== category.name) {
      await requestJson(`${API_BASE}/api/categories/${category.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: category.name }),
      });
      console.log(`updated category ${category.id}`);
    }
  }
}

async function upsertMaterials() {
  const existing = await requestJson(`${API_BASE}/api/materials`);
  const existingMap = new Map(existing.map((item) => [item.id, item]));

  for (const material of materials) {
    const upload = await uploadTexture(material.file);
    const payload = {
      id: material.id,
      name: material.name,
      image: upload.path,
      categoryId: material.categoryId,
      specs: material.specs,
    };

    if (existingMap.has(material.id)) {
      await requestJson(`${API_BASE}/api/materials/${material.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      console.log(`updated material ${material.id} -> ${upload.path}`);
      continue;
    }

    await requestJson(`${API_BASE}/api/materials`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    console.log(`created material ${material.id} -> ${upload.path}`);
  }
}

async function main() {
  await ensureCategories();
  await upsertMaterials();
  console.log('done');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
