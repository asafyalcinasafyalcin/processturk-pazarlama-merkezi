// Tek seferlik: yerel bir medya dosyasını fal.storage'a yükler → public URL yazar.
// Kullanım: node upload-file.mjs <path> [mime]
import { readFile } from 'node:fs/promises';
import path from 'node:path';

try {
  const env = await readFile(new URL('./.env.local', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#') || !s.includes('=')) continue;
    const i = s.indexOf('=');
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const { fal } = await import('@fal-ai/client');
fal.config({ credentials: process.env.FAL_KEY });

const file = path.resolve(process.argv[2]);
const mime = process.argv[3] || (file.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream');
const buf = await readFile(file);
const url = await fal.storage.upload(new File([buf], path.basename(file), { type: mime }));
console.log(url);
