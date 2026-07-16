import fs from 'node:fs';
import path from 'node:path';
import { APP_ROOT, WORKSPACE_ROOT, metaReklamRoot } from './paths.js';
import { genImage } from './providers/gen.js';
import { buildImagePrompt } from './brand.js';
import { downloadAndSave } from './download-asset.js';
import { getContent, patchContent } from './content.js';
import { servedToAbs, saveBuffer } from './media-store.js';

// Kullanıcının yüklediği makine fotoğrafı (public/products/[slug]/base.png)
function resolveUploadedImage(slug) {
  const p = path.join(process.cwd(), 'public', 'products', slug, 'base.png');
  return fs.existsSync(p) ? p : null;
}

// Gerçek ürün görselinin diskteki yolunu bul: cutout.png → base.png → source_image
export function resolveProductImagePath(product) {
  const slug = product.slug;
  const uploaded = resolveUploadedImage(slug);
  if (uploaded) return uploaded;

  const reklam = metaReklamRoot();
  const candidates = [
    path.join(reklam, 'campaigns', 'C1-hazir-makineler', 'creatives', slug, 'cutout.png'),
    path.join(reklam, 'campaigns', 'C1-hazir-makineler', 'creatives', slug, 'base.png'),
  ];
  if (product.source_image) {
    if (path.isAbsolute(product.source_image)) {
      candidates.push(product.source_image);
    } else {
      // workspace-göreli (eski Excel ürünleri) VE app-göreli (website-sync data/uploads/...)
      candidates.push(path.join(WORKSPACE_ROOT, product.source_image));
      candidates.push(path.join(APP_ROOT, product.source_image));
    }
  }
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch { /* skip */ }
  }
  return null;
}

// Hero ürünlerde HF lifestyle sahnesi (9:16 story tercih)
export function resolveHeroSceneImage(product, { sizes = ['story', 'feed', 'square'] } = {}) {
  const slug = product.slug;
  const dir = path.join(metaReklamRoot(), 'campaigns', 'C1-hazir-makineler', 'creatives', slug);
  for (const s of sizes) {
    const p = path.join(dir, `${slug}-hf-scene-${s}.png`);
    try { if (fs.existsSync(p)) return p; } catch { /* skip */ }
  }
  return null;
}

// Video first-frame için görsel — öncelik sırası. Yerel dosyalar `imagePath` olarak döner;
// gen.js bunları fal.storage'a yükleyip her iki motora da uygun public URL'e çevirir
// (motor-bağımsız, güvenilir). CDN/uzak URL'ler `image_url` olarak döner.
// 1. Asaf'ın yüklediği fotoğraf (public/products/[slug]/base.png)
// 2. Önceki görsel üretiminden indirilen yerel kopya (content.gorsel.localPath)
// 3. Reklam klasöründeki gerçek görsel / hero sahne
// 4. Önceki CDN URL
// 5. Otomatik üret → indir → kaydet → kullan
// Hiçbiri yoksa null döner → caller 422 (veya text-to-video) ile yanıt verir.
export async function videoImageInput(product) {
  const slug = product.slug;

  // 1) Asaf'ın yüklediği fotoğraf
  const uploaded = resolveUploadedImage(slug);
  if (uploaded) return { imagePath: uploaded, source: 'uploaded' };

  // 2) Eklenen/üretilen ana görsel (content.gorsel) — media-store veya public yolunu çöz.
  // (Hazır İçerik Ekle / manuel yükleme buraya yazar → eklenen görsel i2v'yi besler.)
  const existing = await getContent(slug).catch(() => null);
  const gorselAbs = servedToAbs(existing?.gorsel?.localPath);
  if (gorselAbs) return { imagePath: gorselAbs, source: existing?.gorsel?.manual ? 'manual' : 'local-cache' };

  // 3) Hero lifestyle sahnesi veya reklam klasöründeki gerçek görsel
  const scene = resolveHeroSceneImage(product);
  if (scene) return { imagePath: scene, source: 'hf-scene' };
  const localImg = resolveProductImagePath(product);
  if (localImg) return { imagePath: localImg, source: 'real' };

  // 4) Önceki CDN URL — yerele indir (CDN'ler expire olabilir)
  if (existing?.gorsel?.url) {
    const { absPath } = await downloadAndSave(existing.gorsel.url, slug, 'gorsel').catch(() => ({}));
    if (absPath) return { imagePath: absPath, source: 'cdn-cache' };
    return { image_url: existing.gorsel.url, source: 'cdn-cache' };
  }

  // 5) Otomatik görsel üret → yerele yaz → kullan.
  // Dispatcher (genImage) env motorunu kullanır: openai gpt-image-1 / higgsfield / fal.
  // Sabit 'flux-schnell' KALDIRILDI (Asaf'ın kalite şikayetinin kökü). openai b64 döndürür.
  try {
    const img = await genImage({ prompt: buildImagePrompt(product), image_size: 'portrait_16_9', aspect_ratio: '9:16' });
    if (img?.b64) {
      const { servedUrl, absPath } = saveBuffer(Buffer.from(img.b64, 'base64'), { slug, type: 'gorsel', ext: 'png' });
      await patchContent(slug, { gorsel: { url: servedUrl, localPath: servedUrl, source: 'auto-gen', at: new Date().toISOString() } }).catch(() => {});
      return { imagePath: absPath, source: 'auto-gen' };
    }
    if (img?.url) {
      const { localPath: lp, absPath: ap } = await downloadAndSave(img.url, slug, 'gorsel');
      if (lp) await patchContent(slug, { gorsel: { url: img.url, localPath: lp, source: 'auto-gen', at: new Date().toISOString() } }).catch(() => {});
      if (ap) return { imagePath: ap, source: 'auto-gen' };
      return { image_url: img.url, source: 'auto-gen' };
    }
  } catch (e) {
    console.warn('[product-image] Otomatik görsel üretimi başarısız:', e.message.slice(0, 80));
  }

  // Hiçbiri yoksa null
  return null;
}
