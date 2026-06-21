// Ham (markasız) ürün klibi + reklam-stili burn-in.
// Panelin tam anlatılı render'ından (lib/render.js) ayrı, "5 saniye" tek-kare reklam akışı:
//   temiz i2v klip → reklam config'inin marka katmanı (fiyat/başlık/CTA + üst logo) →
//   make_video_overlay.py ile gömülür. Tek kaynak overlay = reklam/scripts (statik creative ile aynı).
import { spawn } from 'node:child_process';
import { writeFile, copyFile, mkdir, access } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { APP_ROOT, metaReklamRoot } from './paths.js';

const RENDERS_DIR = path.join(APP_ROOT, 'public', 'renders');

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

// clip.url http(s) ise indir, yerel yol ise kopyala → public/renders/<ad>
async function saveClip(url, dest) {
  await mkdir(path.dirname(dest), { recursive: true });
  if (/^https?:\/\//i.test(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ham klip indirilemedi (${res.status})`);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  } else {
    const src = url.startsWith('file://') ? new URL(url) : url;
    await copyFile(src, dest);
  }
}

/** Ham klibi public/renders'a kaydet → { publicPath, file } */
export async function saveRawClip({ url, slug, lang }) {
  if (!url) throw new Error('ham klip url/yolu yok');
  const name = `${slug}-${lang}-raw-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.mp4`;
  const dest = path.join(RENDERS_DIR, name);
  await saveClip(url, dest);
  return { publicPath: `/api/media/${name}`, file: dest };
}

/** Bir slug için reklam creative config.json'unu bul (reklam/campaigns/<C>/creatives/<slug>/config.json) */
export async function findReklamConfig(slug) {
  const campaignsDir = path.join(metaReklamRoot(), 'campaigns');
  if (!(await exists(campaignsDir))) return null;
  for (const camp of await readdir(campaignsDir)) {
    const cfg = path.join(campaignsDir, camp, 'creatives', slug, 'config.json');
    if (await exists(cfg)) return cfg;
  }
  return null;
}

/**
 * Ham klibe reklam marka katmanını göm (make_video_overlay.py).
 * Ham klipte logo/metin olmadığı için ÜST logo dahil tam overlay temiz çalışır (--no-top YOK).
 * @returns { publicPath, file } | null  (config yoksa null)
 */
export async function brandOverlay({ rawFile, slug, lang }) {
  const config = await findReklamConfig(slug);
  if (!config) return null;
  const name = `${slug}-${lang}-brand-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.mp4`;
  const dest = path.join(RENDERS_DIR, name);
  const script = path.join(metaReklamRoot(), 'scripts', 'make_video_overlay.py');
  await new Promise((resolve, reject) => {
    const p = spawn('python3', [script, config, '--video', rawFile, '--lang', lang, '--out', dest],
      { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`make_video_overlay.py ${c}: ${err.slice(-500)}`))));
  });
  return { publicPath: `/api/media/${name}`, file: dest };
}
