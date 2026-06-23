import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'data', 'library.json');

function readAll() {
  if (!fs.existsSync(FILE)) return [];
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
}

function writeAll(entries) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(entries, null, 2));
}

export function addToLibrary(slug, type, data) {
  const entries = readAll();
  entries.unshift({ slug, type, ...data, at: data.at || new Date().toISOString() });
  writeAll(entries);
}

export function listLibrary(slug) {
  return readAll().filter((e) => !slug || e.slug === slug);
}
