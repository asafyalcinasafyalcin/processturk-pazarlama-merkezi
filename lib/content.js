import { promises as fs } from 'node:fs';
import { atomikJsonYaz } from './atomik-yaz.js';
import path from 'node:path';
import { dataDir, stateFile } from './paths.js';

// Panelin kendi içerik state'i. products.json'a DOKUNMAZ — üretilen reklam metni,
// görsel ve video URL'lerini ürün slug'ına göre saklar.
// Şekil: { "<slug>": { copy:{...}, image:{url,model,at}, video:{url,model,at}, updated_at } }

const FILE = () => stateFile('content.json');

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

export async function readAllContent() {
  try {
    const raw = await fs.readFile(FILE(), 'utf-8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

export async function getContent(slug) {
  const all = await readAllContent();
  return all[slug] || null;
}

// Bir slug'ın content'ini partial olarak günceller (merge).
export async function patchContent(slug, patch) {
  await ensureDir();
  const all = await readAllContent();
  const prev = all[slug] || {};
  all[slug] = { ...prev, ...patch, updated_at: new Date().toISOString() };
  await atomikJsonYaz(FILE(), all);
  return all[slug];
}
