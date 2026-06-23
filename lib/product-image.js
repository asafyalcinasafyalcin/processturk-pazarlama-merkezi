import fs from 'node:fs';
import path from 'node:path';
import { WORKSPACE_ROOT, metaReklamRoot } from './paths.js';
import { uploadLocalImage, generateImage } from './providers/fal.js';
import { genProvider } from './providers/gen.js';
import { buildImagePrompt } from './brand.js';
import { downloadAndSave } from './download-asset.js';
import { getContent, patchContent } from './content.js';

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
    candidates.push(path.isAbsolute(product.source_image)
      ? product.source_image
      : path.join(WORKSPACE_ROOT, product.source_image));
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

// Video first-frame için görsel — 4 adımlı öncelik:
// 1. Asaf'ın yüklediği fotoğraf (public/products/[slug]/base.png)
// 2. Önceki görsel üretiminden indirilen yerel kopya (content.gorsel.localPath)
// 3. Önceki CDN URL (content.gorsel.url — fal.storage'a yükle)
// 4. Otomatik üret → indir → kaydet → kullan
// Hiçbiri yoksa null döner → caller 422 hatası verir.
export async function videoImageInput(product) {
  const slug = product.slug;
  const scene = resolveHeroSceneImage(product);
  const isHF = genProvider('VIDEO') === 'higgsfield';

  // 1) Asaf'ın yüklediği fotoğraf
  const uploaded = resolveUploadedImage(slug);
  if (uploaded) {
    if (isHF) return { imagePath: uploaded, source: 'uploaded' };
    const url = await uploadLocalImage(uploaded);
    return { url, source: 'uploaded', path: uploaded };
  }

  // HF lifestyle sahnesi (sadece HF pipeline'da öncelikli)
  if (scene && isHF) return { imagePath: scene, source: 'hf-scene' };

  // 2) Önceki görsel üretiminden yerel kopya
  const existing = await getContent(slug).catch(() => null);
  const localPath = existing?.gorsel?.localPath;
  if (localPath) {
    const abs = path.join(process.cwd(), 'public', localPath);
    if (fs.existsSync(abs)) {
      if (isHF) return { imagePath: abs, source: 'local-cache' };
      const url = await uploadLocalImage(abs);
      return { url, source: 'local-cache', path: abs };
    }
  }

  // 3) Reklam klasöründeki gerçek görsel veya CDN URL
  if (scene) {
    const url = await uploadLocalImage(scene);
    return { url, source: 'hf-scene', path: scene };
  }
  const localImg = resolveProductImagePath(product);
  if (localImg) {
    if (isHF) return { imagePath: localImg, source: 'real' };
    const url = await uploadLocalImage(localImg);
    return { url, source: 'real', path: localImg };
  }
  if (existing?.gorsel?.url) {
    // CDN URL'si var — fal'a yükle veya HF için indir
    const cdnUrl = existing.gorsel.url;
    if (isHF) {
      // CDN URL'den yerel dosyaya indir
      const { absPath } = await downloadAndSave(cdnUrl, slug, 'gorsel');
      if (absPath) return { imagePath: absPath, source: 'cdn-cache' };
    } else {
      return { url: cdnUrl, source: 'cdn-cache' };
    }
  }

  // 4) Otomatik görsel üret → indir → kullan
  try {
    const img = await generateImage({ model: 'flux-schnell', prompt: buildImagePrompt(product), image_size: 'portrait_16_9' });
    if (img?.url) {
      const { localPath: lp, absPath: ap } = await downloadAndSave(img.url, slug, 'gorsel');
      if (lp) await patchContent(slug, { gorsel: { url: img.url, localPath: lp, source: 'auto-gen', at: new Date().toISOString() } }).catch(() => {});
      if (isHF && ap) return { imagePath: ap, source: 'auto-gen' };
      return { url: img.url, source: 'auto-gen' };
    }
  } catch (e) {
    console.warn('[product-image] Otomatik görsel üretimi başarısız:', e.message.slice(0, 80));
  }

  // Hiçbiri yoksa null
  return null;
}
