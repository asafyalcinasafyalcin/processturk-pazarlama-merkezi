import fs from 'node:fs';
import path from 'node:path';
import { metaReklamRoot } from './paths.js';

// Reklam motoru (reklam/) içindeki creative config + görsel yardımcıları.
// Tüm creative'ler campaigns/<campaign>/creatives/<slug>/ altında durur.

export function campaignsDir() {
  return path.join(metaReklamRoot(), 'campaigns');
}

// Bir ürünün creative klasörünü tüm kampanyalar içinde bul (config.json'a göre).
export function creativeDir(slug) {
  const base = campaignsDir();
  let campaigns = [];
  try { campaigns = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()); }
  catch { return null; }
  for (const c of campaigns) {
    const dir = path.join(base, c.name, 'creatives', slug);
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

export function configPath(slug) {
  const dir = creativeDir(slug);
  return dir ? path.join(dir, 'config.json') : null;
}

export function readConfig(slug) {
  const p = configPath(slug);
  if (!p || !fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
  catch { return null; }
}

export function writeConfig(slug, cfg) {
  const p = configPath(slug);
  if (!p) throw new Error(`config bulunamadı: ${slug}`);
  fs.writeFileSync(p, JSON.stringify(cfg, null, 1) + '\n', 'utf-8');
  return p;
}

// Üretilmiş markalı creative PNG'leri (cutout/props/base/_pre gibi ara dosyalar hariç).
// Dönen yol /api/creative-image rotasının beklediği "slug/dosya.png" formatında relatif.
export function listCreatives(slug) {
  const dir = creativeDir(slug);
  if (!dir) return [];
  let files = [];
  try { files = fs.readdirSync(dir); } catch { return []; }
  const SKIP = new Set(['cutout.png', 'props.png', 'base.png']);
  let pngs = files
    .filter((f) => f.endsWith('.png'))
    .filter((f) => !f.startsWith('_') && !SKIP.has(f))
    .filter((f) => !f.startsWith('preview-'))     // mockup'lar ayrı
    .filter((f) => !f.endsWith('-scene.png'));    // framed master fotoğrafı (ham kaynak)
  // Standart düzen: "framed" (çerçeveli kart) seti varsa SADECE onu göster — eski
  // cutout/hf/b taslakları gizlenir (dosyalar silinmez, sadece listede görünmez).
  const framed = pngs.filter((f) => f.includes('-framed-'));
  if (framed.length) pngs = framed;
  return pngs
    .map((f) => parseCreativeName(slug, f, dir))
    .sort((a, b) => a.file.localeCompare(b.file));
}

// granul-dolum-b-en-feed.png → { variant:'b', lang:'en', size:'feed' }
function parseCreativeName(slug, file, dir) {
  let rest = file.replace(/\.png$/, '');
  if (rest.startsWith(slug)) rest = rest.slice(slug.length).replace(/^-/, '');
  const parts = rest.split('-');
  const SIZES = ['feed', 'story', 'square'];
  const LANGS = ['tr', 'en', 'ar', 'fr', 'ru'];
  let size = '', lang = '', variant = 'a';
  for (const p of parts) {
    if (SIZES.includes(p)) size = p;
    else if (LANGS.includes(p)) lang = p;
    else if (p === 'b') variant = 'b';
  }
  return {
    file,
    rel: `${slug}/${file}`,
    size: size || '—',
    lang: lang || '—',
    variant,
    mtime: safeMtime(path.join(dir, file)),
  };
}

function safeMtime(p) {
  try { return fs.statSync(p).mtimeMs; } catch { return 0; }
}

// Güvenli görsel yol çözümü: yalnızca campaigns/ ağacındaki .png dosyalarına izin ver.
export function resolveCreativeImage(rel) {
  if (!rel || rel.includes('..') || !rel.endsWith('.png')) return null;
  // rel = "<slug>/<file.png>"
  const slug = rel.split('/')[0];
  const dir = creativeDir(slug);
  if (!dir) return null;
  const full = path.join(dir, path.basename(rel));
  const base = campaignsDir();
  if (!full.startsWith(base) || !fs.existsSync(full)) return null;
  return full;
}
