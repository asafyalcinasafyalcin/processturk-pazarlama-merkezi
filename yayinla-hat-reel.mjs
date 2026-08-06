// Hat Reel'i yayını — Instagram Reels + Facebook Video (6 hat × EN·FR·AR·RU).
// Kaynak: data/sosyal-metinler-hatlar.json (Remotion Studio üreteci). Reel'ler public URL'den
// çekilir (Meta Graph dosya kabul etmez). TR sosyalde YOK.
//
// ⚠️ TOPLU GÖNDERİM = Asaf'ın AÇIK onayı. Varsayılan --dene (kuru): hiçbir şey göndermez.
//   node yayinla-hat-reel.mjs --dene                 # ne gideceğini listeler
//   node yayinla-hat-reel.mjs --slug sos-uretim-hatti --dil en   # tek hedef
//   node yayinla-hat-reel.mjs --gonder               # GERÇEK yayın (yalnız Asaf onayıyla)
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const GONDER = args.includes('--gonder');           // açık bayrak olmadan ASLA göndermez
const bayrak = (ad) => { const i = args.indexOf(ad); return i >= 0 ? args[i + 1] : null; };
const slugF = bayrak('--slug');
const dilF  = bayrak('--dil');

try {
  const env = await readFile(new URL('./.env.local', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const s = line.trim(); if (!s || s.startsWith('#') || !s.includes('=')) continue;
    const i = s.indexOf('='); const k = s.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = s.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
} catch {}

const kayitlar = JSON.parse(await readFile(new URL('./data/sosyal-metinler-hatlar.json', import.meta.url), 'utf8'))
  .filter(k => (!slugF || k.slug === slugF) && (!dilF || k.dil === dilF));

// Reel kapağı (Instagram grid kartı): kayıtta coverUrl varsa onu kullan, yoksa reelUrl'den
// türet — kapak dosyası reel'le AYNI klasörde: reel-<dil>-9x16.mp4 → reel-cover-<dil>.jpg
// (Remotion Studio scripts/hat-reel-kapak-uret.mjs üretir, site public'e kopyalar).
const kapakUrl = (k) => k.coverUrl || (k.reelUrl ? k.reelUrl.replace(/reel-[a-z]{2}-9x16\.mp4$/i, `reel-cover-${k.dil}.jpg`) : null);

console.log(`\n═══ HAT REEL YAYINI ${GONDER ? '(GERÇEK GÖNDERİM)' : '(KURU — hiçbir şey gitmez)'} ═══`);
console.log(`Hedef: ${kayitlar.length} reel × 2 kanal (Instagram + Facebook) = ${kayitlar.length * 2} gönderi`);
console.log(`Diller: EN·FR·AR·RU · TR YOK\n`);
for (const k of kayitlar) {
  console.log(`• ${k.slug} [${k.dil.toUpperCase()}]  →  ${k.reelUrl}`);
  console.log(`    kapak: ${kapakUrl(k) || '(yok — IG otomatik kare seçer)'}`);
  console.log(`    IG caption: ${k.instagram.split('\n')[0].slice(0, 70)}…`);
}

if (!GONDER) {
  console.log(`\n→ Gerçek yayın için:  node yayinla-hat-reel.mjs --gonder   (yalnız Asaf'ın "evet gönder" onayıyla)`);
  process.exit(0);
}

const { publishInstagramReel, publishFacebookVideo } = await import('./lib/meta-publish.js');
for (const k of kayitlar) {
  try {
    const ig = await publishInstagramReel({ videoUrl: k.reelUrl, caption: k.instagram, coverUrl: kapakUrl(k) });
    console.log(`✓ IG ${k.slug}/${k.dil}: ${ig?.id || 'ok'}`);
    const fb = await publishFacebookVideo({ videoUrl: k.reelUrl, caption: k.linkedin });
    console.log(`✓ FB ${k.slug}/${k.dil}: ${fb?.id || 'ok'}`);
  } catch (e) { console.error(`✗ ${k.slug}/${k.dil}: ${e.message}`); }
}
