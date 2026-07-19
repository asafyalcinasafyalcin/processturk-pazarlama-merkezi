import { createHash } from 'node:crypto';
import { atomikJsonYaz } from './atomik-yaz.js';
import { promises as fs } from 'node:fs';
import { stateFile, dataDir } from './paths.js';

// Prompt-hash tabanlı üretim cache'i. Aynı prompt+model+params kombinasyonu daha önce
// üretildiyse API'ye hiç çağrı yapılmaz — kayıtlı URL döner.
// Dosya: data/gen-cache.json  { "<sha256-key>": { url, provider, model, cap, at } }

const FILE = () => stateFile('gen-cache.json');

const TTL_DAYS = { image: 30, video: 30, voice: 14, music: 30 };
const CLEANUP_AGE_DAYS = 90;

function buildKey(cap, opts) {
  const sorted = Object.fromEntries(
    Object.entries({ cap, ...opts })
      .filter(([, v]) => v != null)
      .sort(([a], [b]) => a.localeCompare(b))
  );
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 32);
}

async function readCache() {
  try {
    return JSON.parse(await fs.readFile(FILE(), 'utf-8'));
  } catch {
    return {};
  }
}

async function writeCache(cache) {
  await fs.mkdir(dataDir(), { recursive: true });
  await atomikJsonYaz(FILE(), cache);
}

export async function getCached(cap, opts) {
  const key = buildKey(cap, opts);
  const cache = await readCache();
  const entry = cache[key];
  if (!entry?.url) return null;
  const ageDays = (Date.now() - new Date(entry.at).getTime()) / 86400000;
  if (ageDays > (TTL_DAYS[cap] ?? 30)) return null;
  return entry;
}

export async function setCached(cap, opts, result) {
  const key = buildKey(cap, opts);
  const cache = await readCache();
  cache[key] = { ...result, cap, at: new Date().toISOString() };
  // 90 günden eski girişleri temizle
  for (const [k, v] of Object.entries(cache)) {
    if ((Date.now() - new Date(v.at).getTime()) > CLEANUP_AGE_DAYS * 86400000) {
      delete cache[k];
    }
  }
  await writeCache(cache);
}
