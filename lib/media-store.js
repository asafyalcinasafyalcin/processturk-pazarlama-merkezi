// Çalışma-zamanı medya deposu — yüklenen / içe aktarılan / indirilen tüm medyayı
// data/uploads/ altına yazar (VPS'te kalıcı bind-mount) ve /api/media/<dosya> ile servis edilir.
//
// KRİTİK: `next start` public/ klasörüne ÇALIŞMA ZAMANINDA yazılan dosyaları sunmaz
// (bkz. app/api/media/[name] ve app/api/creative-image yorumları). Bu yüzden üretim/yükleme
// çıktıları public/ yerine BURAYA yazılmalı — aksi halde canlı panelde görünmez ve
// Meta yayını için public URL üretilemez.
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './paths.js';

const EXT_BY_TYPE = { gorsel: 'png', video: 'mp4', ses: 'mp3' };

// URL/CDN uzantısından servis edilebilir uzantı çıkar (sorgu parametresini at).
function extFromUrl(url, fallback) {
  try {
    const clean = String(url).split('?')[0].toLowerCase();
    const m = clean.match(/\.(png|jpe?g|webp|mp4|mov|webm|mp3|wav|m4a|aac|ogg)$/);
    if (m) return m[1] === 'jpeg' ? 'jpg' : m[1];
  } catch { /* yoksay */ }
  return fallback;
}

function uploadsDir() {
  const dir = path.join(dataDir(), 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// /api/media/[name] yalnızca düz dosya adı bekler (path.basename) → alt klasör yok.
function buildFileName(slug, type, ext) {
  const safeSlug = String(slug || 'asset').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'asset';
  const rnd = Math.random().toString(36).slice(2, 6);
  return `${safeSlug}-${type || 'medya'}-${Date.now()}-${rnd}.${ext}`;
}

// Buffer'ı depoya yaz → { servedUrl, absPath, fileName }
export function saveBuffer(buf, { slug, type = 'gorsel', ext } = {}) {
  const finalExt = ext || EXT_BY_TYPE[type] || 'bin';
  const name = buildFileName(slug, type, finalExt);
  const absPath = path.join(uploadsDir(), name);
  fs.writeFileSync(absPath, buf);
  return { servedUrl: `/api/media/${name}`, absPath, fileName: name };
}

// Uzak URL'i indir → depoya yaz → { servedUrl, absPath, fileName }
export async function saveFromUrl(url, { slug, type = 'gorsel' } = {}) {
  if (!url) throw new Error('saveFromUrl: url boş');
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`İndirme hatası HTTP ${res.status}: ${String(url).slice(0, 80)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = extFromUrl(url, EXT_BY_TYPE[type] || 'bin');
  return saveBuffer(buf, { slug, type, ext });
}
