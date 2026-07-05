// Tek seferlik: yerel görseli fal.ai Seedance Fast ile image-to-video yapar.
// Kullanım: node animate-clip.mjs <image> <out.mp4> "<motion prompt>" [duration]
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// .env.local → process.env (FAL_KEY)
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

const [, , imgArg, outArg, promptArg, durArg] = process.argv;
const img = path.resolve(imgArg);
const out = path.resolve(outArg);
const prompt = promptArg || 'Smooth realistic industrial motion, the conveyor belt moves and jars travel forward along the line, stable camera.';
const duration = durArg || '5';

const { uploadLocalImage, generateVideo } = await import('./lib/providers/fal.js');

console.log('[1/3] Görsel fal.storage’a yükleniyor:', path.basename(img));
const image_url = await uploadLocalImage(img);
console.log('     url:', image_url);

console.log('[2/3] Seedance 2.0 Fast image-to-video (' + duration + 's, 9:16, 720p)…');
const res = await generateVideo({
  model: 'seedance-2-fast',
  image_url,
  prompt,
  duration,
  aspect_ratio: '9:16',
  resolution: '720p',
});
if (!res.url) throw new Error('Video URL dönmedi: ' + JSON.stringify(res));
console.log('     video url:', res.url);

console.log('[3/3] İndiriliyor →', path.basename(out));
const r = await fetch(res.url);
const buf = Buffer.from(await r.arrayBuffer());
await writeFile(out, buf);
console.log('Hazır:', out, '(' + buf.length + ' bytes)');
