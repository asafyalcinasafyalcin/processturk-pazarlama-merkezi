// Per-ürün feature brief sistemi.
// <dataDir>/briefs/[slug].json dosyasından ürün özelliklerini okur (kiracı-izole).
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './paths.js';

const BRIEFS_DIR = path.join(dataDir(), 'briefs');

export function readBrief(slug) {
  const p = path.join(BRIEFS_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

export function writeBrief(slug, data) {
  if (!fs.existsSync(BRIEFS_DIR)) fs.mkdirSync(BRIEFS_DIR, { recursive: true });
  const existing = readBrief(slug) || {};
  const merged = { ...existing, ...data, slug, last_updated: new Date().toISOString() };
  fs.writeFileSync(path.join(BRIEFS_DIR, `${slug}.json`), JSON.stringify(merged, null, 2));
  return merged;
}

export function listBriefs() {
  if (!fs.existsSync(BRIEFS_DIR)) return [];
  return fs.readdirSync(BRIEFS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(BRIEFS_DIR, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean);
}
