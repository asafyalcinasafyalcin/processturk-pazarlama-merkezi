// Append-only varlık kütüphanesi — üretilen HER görsel/video/ses/metin sürümünü saklar.
// Pipeline'dan bağımsızdır; tek kaynak data/library.json. Silme desteklenir (kalıcı).
import fs from 'node:fs';
import path from 'node:path';
import { stateFile } from './paths.js';
import { atomikJsonYazSync, bozuguKenaraAl } from './atomik-yaz.js';

const FILE = stateFile('library.json'); // kiracı-izole (processturk=data/, diğer=data/<tenant>/)

function readAll() {
  if (!fs.existsSync(FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    // ⚠️ Bozuk dosyayı SESSİZCE [] dönmek veri kaybına yol açar: sonraki writeAll
    // bozuk içeriği boş diziyle EZER ve kurtarma şansı kalmaz. 2026-07-19'da
    // content.json'da tam bu oldu (disk dolunca 0 bayta düştü).
    // Doğrusu: bozuk dosyayı kenara al, öyle devam et — içerik incelenebilir kalır.
    bozuguKenaraAl(FILE);
    return [];
  }
}

function writeAll(entries) {
  // Atomik: geçici dosya + fsync + rename. Disk dolarsa/süreç ölürse mevcut
  // dosyaya DOKUNULMAZ (düz writeFileSync önce sıfırlar, yarıda kalırsa siler).
  atomikJsonYazSync(FILE, entries);
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
