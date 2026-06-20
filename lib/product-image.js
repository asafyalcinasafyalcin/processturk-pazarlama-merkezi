import fs from 'node:fs';
import path from 'node:path';
import { WORKSPACE_ROOT, metaReklamRoot } from './paths.js';
import { uploadLocalImage, generateImage } from './providers/fal.js';
import { genProvider } from './providers/gen.js';
import { buildImagePrompt } from './brand.js';

// Gerçek ürün görselinin diskteki yolunu bul: cutout.png (şeffaf, kampanya) tercih,
// sonra products.json source_image. Bulamazsa null → flux fallback.
export function resolveProductImagePath(product) {
  const slug = product.slug;
  const reklam = metaReklamRoot();
  const candidates = [
    path.join(reklam, 'campaigns', 'C1-hazir-makineler', 'creatives', slug, 'cutout.png'),
    path.join(reklam, 'campaigns', 'C1-hazir-makineler', 'creatives', slug, 'base.png'),
  ];
  if (product.source_image) {
    // source_image workspace köküne göreli (ör. Processturk_Satis_Dolum_Makinaları/...).
    candidates.push(path.isAbsolute(product.source_image)
      ? product.source_image
      : path.join(WORKSPACE_ROOT, product.source_image));
  }
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch { /* skip */ }
  }
  return null;
}

// Hero ürünlerde video, statik B-hf creative ile AYNI görünümden gelsin diye Higgsfield
// lifestyle sahnesini (önce 9:16 story) video first-frame girdisi olarak kullan.
// Sahne yoksa null → eski (cutout/source) davranışına düşülür.
export function resolveHeroSceneImage(product, { sizes = ['story', 'feed', 'square'] } = {}) {
  const slug = product.slug;
  const dir = path.join(metaReklamRoot(), 'campaigns', 'C1-hazir-makineler', 'creatives', slug);
  for (const s of sizes) {
    const p = path.join(dir, `${slug}-hf-scene-${s}.png`);
    try { if (fs.existsSync(p)) return p; } catch { /* skip */ }
  }
  return null;
}

// Video first-frame için public URL döndür (fal yolu). Gerçek görsel varsa fal.storage'a
// yükler; yoksa flux ile üretir.
export async function productImageUrl(product) {
  const local = resolveProductImagePath(product);
  if (local) {
    const url = await uploadLocalImage(local);
    return { url, source: 'real', path: local };
  }
  const img = await generateImage({ model: 'flux-schnell', prompt: buildImagePrompt(product), image_size: 'portrait_16_9' });
  return { url: img.url, source: 'ai', path: null };
}

// Sağlayıcıya göre video first-frame girdisi:
//  - higgsfield: yerel dosya yolu (CLI otomatik yükler; fal upload'a gerek yok)
//  - fal: fal.storage'a yüklenmiş URL
export async function videoImageInput(product) {
  // Hero'da HF lifestyle sahnesi (varsa) statik B-hf ile tutarlılık için önceliklidir.
  const scene = resolveHeroSceneImage(product);
  if (genProvider('VIDEO') === 'higgsfield') {
    const local = scene || resolveProductImagePath(product);
    return local ? { imagePath: local, source: scene ? 'hf-scene' : 'real' } : { source: 'none' };
  }
  if (scene) {
    const url = await uploadLocalImage(scene);
    return { url, source: 'hf-scene', path: scene };
  }
  return await productImageUrl(product); // { url, source }
}
