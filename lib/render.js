import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, mkdir, copyFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { APP_ROOT } from './paths.js';
import { trustCard, specCard, ctaCard, captionOverlay, W, H } from './overlays.js';
import { RTL_LANGS } from './brand.js';

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`${bin} ${c}: ${err.slice(-500)}`))));
  });
}
const ffmpeg = (a) => run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...a]);

function ffprobe(file) {
  return new Promise((resolve) => {
    const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => resolve(parseFloat(out.trim()) || 0));
  });
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`indirilemedi ${url} → ${res.status}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
}

// Sabit görsel kart → kısa klip (hafif zoom)
async function cardClip(pngPath, dur, out) {
  const frames = Math.max(30, Math.round(dur * 30));
  await ffmpeg(['-loop', '1', '-i', pngPath, '-t', String(dur),
    '-vf', `scale=${W}:${H},zoompan=z='min(zoom+0.0006,1.06)':d=${frames}:s=${W}x${H}:fps=30,format=yuv420p`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', out]);
}

// Ürün fal klibi (segment) + altyazı overlay → normalize klip (9:16 cover)
async function productClip(clipPath, capPng, out, { ss = 0, t } = {}) {
  const pre = [];
  if (ss) pre.push('-ss', String(ss));
  if (t) pre.push('-t', String(t));
  await ffmpeg([...pre, '-i', clipPath, '-i', capPng,
    '-filter_complex',
    `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30[bg];[bg][1:v]overlay=0:0[v]`,
    '-map', '[v]', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', out]);
}

/**
 * scenes: hook/benefit (ürün klip segmenti) · trust/spec/cta (markalı kart)
 * voiceUrl/musicUrl: opsiyonel. → { publicPath, file }
 */
export async function renderAdVideo({ slug, lang, scenes, voiceUrl, musicUrl, whatsapp, web, logoPath }) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ptad-'));
  const clipCache = new Map(); // url → indirilen yerel dosya (aynı klip birden çok sahnede)
  const rtl = RTL_LANGS.includes(lang);
  try {
    const sceneFiles = [];
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const out = path.join(tmp, `scene_${i}.mp4`);
      const png = path.join(tmp, `c_${i}.png`);
      if (s.type === 'hook' || s.type === 'benefit') {
        // ürün klibi segmenti + altyazı overlay (logo sağ-üst)
        let clip = clipCache.get(s.clipUrl);
        if (!clip) { clip = path.join(tmp, `clip_${clipCache.size}.mp4`); await download(s.clipUrl, clip); clipCache.set(s.clipUrl, clip); }
        const cap = path.join(tmp, `cap_${i}.png`);
        await writeFile(cap, await captionOverlay({ lines: s.captionLines || [s.caption], logoPath, rtl }));
        await productClip(clip, cap, out, { ss: s.segStart || 0, t: s.durationSec });
      } else if (s.type === 'trust') {
        await writeFile(png, await trustCard({ lines: s.lines, logoPath, rtl }));
        await cardClip(png, s.durationSec, out);
      } else if (s.type === 'cta') {
        await writeFile(png, await ctaCard({ title: s.title, whatsapp, web, logoPath, rtl }));
        await cardClip(png, s.durationSec, out);
      } else {
        // spec
        await writeFile(png, await specCard({ title: s.title, lines: s.specLines, logoPath, rtl }));
        await cardClip(png, s.durationSec, out);
      }
      sceneFiles.push(out);
    }

    // concat (hepsi aynı codec/parametre → copy)
    const list = path.join(tmp, 'list.txt');
    await writeFile(list, sceneFiles.map((f) => `file '${f}'`).join('\n'));
    const concat = path.join(tmp, 'concat.mp4');
    await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', concat]);
    const vdur = await ffprobe(concat);

    // ses: voice + müzik mix (yoksa sessiz)
    const final = path.join(tmp, 'final.mp4');
    const audioInputs = [];
    if (voiceUrl) { const v = path.join(tmp, 'voice.mp3'); await download(voiceUrl, v); audioInputs.push({ file: v, vol: 1.0 }); }
    if (musicUrl) { const m = path.join(tmp, 'music.mp3'); await download(musicUrl, m); audioInputs.push({ file: m, vol: 0.16 }); }

    if (audioInputs.length === 0) {
      await copyFile(concat, final);
    } else {
      const args = ['-i', concat];
      audioInputs.forEach((a) => args.push('-i', a.file));
      const labels = audioInputs.map((a, idx) => `[${idx + 1}:a]volume=${a.vol}[a${idx}]`).join(';');
      const mixIn = audioInputs.map((_, idx) => `[a${idx}]`).join('');
      const mix = audioInputs.length > 1
        ? `${labels};${mixIn}amix=inputs=${audioInputs.length}:duration=longest:dropout_transition=0[mx];[mx]apad[a]`
        : `${labels};[a0]apad[a]`;
      args.push('-filter_complex', mix, '-map', '0:v', '-map', '[a]',
        '-t', String(vdur), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', final);
      await ffmpeg(args);
    }

    // public/renders'a taşı
    const rendersDir = path.join(APP_ROOT, 'public', 'renders');
    await mkdir(rendersDir, { recursive: true });
    const name = `${slug}-${lang}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.mp4`;
    const dest = path.join(rendersDir, name);
    await copyFile(final, dest);
    // next start public/ runtime dosyalarını sunmadığı için API route üzerinden sun.
    return { publicPath: `/api/media/${name}`, file: dest, durationSec: vdur };
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}
