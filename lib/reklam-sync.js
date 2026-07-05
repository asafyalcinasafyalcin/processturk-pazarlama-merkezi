// Reklam motorunun ürettiği final creative'leri (reklam/campaigns/<C>/creatives/<slug>/)
// panelin Varlık Kütüphanesi'ne (data/library.json) otomatik aktarır. Dosyalar data/uploads'a
// kopyalanır (saveBuffer) ve /api/media ile sunulur. İdempotent: reklamSource (dosya adı) ile
// dedupe edilir, her sayfa yüklemesinde yalnız yeni dosyalar çekilir.
import fs from 'node:fs';
import path from 'node:path';
import { metaReklamRoot } from './paths.js';
import { saveBuffer } from './media-store.js';
import { addToLibrary, listLibrary } from './library.js';
import { getContent, patchContent } from './content.js';

// Final görsel: <ad>-<lang>-<format>.png (ara üretimler `_` önekli; `-hf-scene-` arka planlar hariç).
const IMG_FINAL_RE = /-(tr|en|ar|fr|ru)-(feed|story|square)\.png$/i;
const VIDEO_RE = /\.mp4$/i;

function parseLang(name) {
  // -<lang>- (statik: ...-ar-feed.png) veya -<lang>. (video: video-hat-en.mp4) veya -<lang> (son).
  const m = String(name).match(/-(tr|en|ar|fr|ru)(?=[-.]|$)/i);
  return m ? m[1].toLowerCase() : 'tr';
}

function isFinalImage(name) {
  if (name.startsWith('_')) return false;        // ara üretim (_scene, _cand, _conv…)
  if (name.includes('-hf-scene-')) return false; // overlay öncesi ham sahne
  return IMG_FINAL_RE.test(name);
}
function isFinalVideo(name) {
  if (name.startsWith('_')) return false;        // ara/kontrol klipleri
  return VIDEO_RE.test(name);
}

// Klasör bu ürüne mi ait? Klasör adı slug ile birebir, slug'ın hyphen-sınırlı öneki
// (ör. "sos-hatti" ⊂ "sos-hatti-anahtar-teslim"), ya da içinde slug-önekli dosya varsa.
// (Statikler slug öneklidir; videolar — video-hat, konveyor — jenerik adlı olabilir, bu yüzden
//  eşleşen klasörün TÜM final'lerini alırız.)
function dirMatchesSlug(dirName, slug, files) {
  if (dirName === slug) return true;
  if (slug.startsWith(dirName + '-')) return true;
  return files.some((f) => f.startsWith(slug + '-') || f.startsWith(slug + '.'));
}

// Bu slug'a ait tüm kampanya creative klasörleri.
function listCreativeDirs(slug) {
  const base = path.join(metaReklamRoot(), 'campaigns');
  if (!fs.existsSync(base)) return [];
  const dirs = [];
  for (const camp of fs.readdirSync(base)) {
    const creativesDir = path.join(base, camp, 'creatives');
    let subs;
    try { subs = fs.readdirSync(creativesDir); } catch { continue; }
    for (const sub of subs) {
      const cdir = path.join(creativesDir, sub);
      let files;
      try {
        if (!fs.statSync(cdir).isDirectory()) continue;
        files = fs.readdirSync(cdir);
      } catch { continue; }
      if (dirMatchesSlug(sub, slug, files)) dirs.push(cdir);
    }
  }
  return dirs;
}

export async function syncReklamCreatives(slug) {
  if (!slug) return { imported: 0, newestImageUrl: null };
  const dirs = listCreativeDirs(slug);
  if (!dirs.length) return { imported: 0, newestImageUrl: null };

  // Daha önce aktarılan dosya adları (dedupe).
  const existing = new Set(listLibrary(slug).map((e) => e.reklamSource).filter(Boolean));
  let imported = 0;
  let newestImageUrl = null;

  for (const dir of dirs) {
    let files;
    try { files = fs.readdirSync(dir); } catch { continue; }
    for (const name of files) {
      const isImg = isFinalImage(name);
      const isVid = isFinalVideo(name);
      if (!isImg && !isVid) continue;
      if (existing.has(name)) continue; // zaten aktarılmış

      let buf;
      try { buf = fs.readFileSync(path.join(dir, name)); } catch { continue; }
      const type = isVid ? 'video' : 'gorsel';
      const ext = isVid ? 'mp4' : 'png';
      const { servedUrl } = saveBuffer(buf, { slug, type, ext });
      addToLibrary(slug, type, {
        url: servedUrl, localPath: servedUrl, lang: parseLang(name),
        imageSource: 'reklam', reklamSource: name, at: new Date().toISOString(),
      });
      existing.add(name);
      imported++;
      if (isImg && /-feed\.png$/i.test(name) && !newestImageUrl) newestImageUrl = servedUrl;
    }
  }

  // Ürünün aktif görseli boşsa, bir reklam görselini (tercihen feed) ana görsel yap.
  try {
    const cur = await getContent(slug).catch(() => null);
    if (!cur?.gorsel?.url && !cur?.gorsel?.localPath) {
      const libImgs = listLibrary(slug).filter((e) => e.imageSource === 'reklam' && e.type === 'gorsel' && (e.url || e.localPath));
      const feed = libImgs.find((e) => /-feed\.png$/i.test(e.reklamSource || ''));
      const pick = feed || libImgs[0];
      const url = pick?.url || pick?.localPath;
      if (url) {
        await patchContent(slug, { gorsel: { url, localPath: url, imageSource: 'reklam', at: new Date().toISOString() } });
        newestImageUrl = newestImageUrl || url;
      }
    }
  } catch { /* ana görsel doldurma best-effort */ }

  return { imported, newestImageUrl };
}
