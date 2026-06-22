import { promises as fs } from 'node:fs';
import { dataDir, stateFile } from './paths.js';

// İçerik takvimi / yayın kuyruğu. Her öğe bir platforma gidecek tek bir gönderi.
// status akışı: draft → approved → published  (onaysız yayın YOK).
// Şekil: { items: [ {id, slug, platform, lang, variantId, caption, videoUrl,
//                    scheduledAt, status, publishedAt, result} ] }

const FILE = () => stateFile('calendar.json');
export const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'x'];
// Gerçek API yayını olan platformlar. Instagram/Facebook → Meta Graph (meta-publish.js);
// LinkedIn/X → icerik-ajani. TikTok/YouTube henüz assisted (ayrı API onayı bekliyor).
export const REAL_PUBLISH = ['instagram', 'facebook', 'linkedin', 'x'];
export const META_PUBLISH = ['instagram', 'facebook'];
export const ICERIK_PUBLISH = ['linkedin', 'x'];

async function ensureDir() { await fs.mkdir(dataDir(), { recursive: true }); }

export async function readCalendar() {
  try {
    const raw = await fs.readFile(FILE(), 'utf-8');
    const obj = JSON.parse(raw);
    return Array.isArray(obj?.items) ? obj : { items: [] };
  } catch (err) {
    if (err.code === 'ENOENT') return { items: [] };
    throw err;
  }
}

async function write(cal) {
  await ensureDir();
  await fs.writeFile(FILE(), JSON.stringify(cal, null, 2) + '\n', 'utf-8');
}

export async function addItem(item) {
  const cal = await readCalendar();
  const rec = {
    id: 'post-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    slug: item.slug,
    platform: item.platform,
    lang: item.lang || 'tr',
    variantId: item.variantId || null,
    caption: item.caption || '',
    imageUrl: item.imageUrl || '',
    videoUrl: item.videoUrl || '',
    scheduledAt: item.scheduledAt || null,
    status: 'draft',
    createdAt: new Date().toISOString(),
    publishedAt: null,
    result: null,
  };
  cal.items.push(rec);
  await write(cal);
  return rec;
}

export async function updateItem(id, patch) {
  const cal = await readCalendar();
  const it = cal.items.find((x) => x.id === id);
  if (!it) return null;
  Object.assign(it, patch);
  await write(cal);
  return it;
}

export async function getItem(id) {
  const cal = await readCalendar();
  return cal.items.find((x) => x.id === id) || null;
}

export async function deleteItem(id) {
  const cal = await readCalendar();
  cal.items = cal.items.filter((x) => x.id !== id);
  await write(cal);
}
