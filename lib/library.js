// Append-only varlık kütüphanesi — üretilen HER görsel/video/ses/metin sürümünü saklar.
// Pipeline'dan bağımsızdır; tek kaynak data/library.json. Silme desteklenir (kalıcı).
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

let counter = 0;
function makeId() {
  counter = (counter + 1) % 1000;
  return `lib-${Date.now()}-${counter}`;
}

// type: 'gorsel' | 'video' | 'ses' | 'metin'
export function addToLibrary(slug, type, data) {
  const entries = readAll();
  const at = data.at || new Date().toISOString();
  entries.unshift({ id: makeId(), slug, type, ...data, at });
  writeAll(entries);
  return entries[0];
}

export function listLibrary(slug) {
  return readAll().filter((e) => !slug || e.slug === slug);
}

// Tüm ürünlerin kütüphanesi (genel arşiv)
export function listAllLibrary() {
  return readAll();
}

// id veya at ile sil
export function deleteFromLibrary(id) {
  const entries = readAll();
  const next = entries.filter((e) => e.id !== id && e.at !== id);
  writeAll(next);
  return entries.length - next.length;
}

// Arşivle / arşivden çıkar (silmeden gizle). id veya at ile eşleşir.
export function setArchived(id, archived) {
  const entries = readAll();
  let changed = 0;
  for (const e of entries) {
    if (e.id === id || e.at === id) { e.archived = Boolean(archived); changed++; }
  }
  if (changed) writeAll(entries);
  return changed;
}
