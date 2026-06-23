// CDN URL'lerini yerel public/ klasörüne indirir.
// CDN URL'leri expire olur; yerel kopya kalıcıdır.
import fs from 'node:fs';
import path from 'node:path';

const EXT_MAP = { gorsel: 'png', video: 'mp4', ses: 'mp3' };

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * URL'i public/generated/[slug]/[type]/[slug]-[type]-[ts].[ext] konumuna indir.
 * @returns { localPath: '/generated/...', absPath: '/absolute/...' }
 */
export async function downloadAndSave(url, slug, type) {
  if (!url) throw new Error('downloadAndSave: url boş');
  const ext = EXT_MAP[type] || 'bin';
  const ts = Date.now();
  const filename = `${slug}-${type}-${ts}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'generated', slug, type);
  ensureDir(dir);
  const absPath = path.join(dir, filename);
  const localPath = `/generated/${slug}/${type}/${filename}`;

  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} indirme hatası: ${url.slice(0, 80)}`);
    const buf = await res.arrayBuffer();
    fs.writeFileSync(absPath, Buffer.from(buf));
    return { localPath, absPath };
  } catch (e) {
    // İndirme başarısız olursa sessizce atla (CDN URL hâlâ content.json'da kalır)
    console.warn('[download-asset] indirme başarısız, CDN URL kullanılacak:', e.message.slice(0, 120));
    return { localPath: null, absPath: null };
  }
}
