import fs from 'node:fs';
import path from 'node:path';
import { WORKSPACE_ROOT } from './paths.js';
import { uploadLocalImage, generateImage } from './providers/fal.js';
import { genProvider } from './providers/gen.js';
import { buildImagePrompt } from './brand.js';

// Gerçek ürün görselinin diskteki yolunu bul: cutout.png (şeffaf, kampanya) tercih,
// sonra products.json source_image. Bulamazsa null → flux fallback.
export function resolveProductImagePath(product) {
  const slug = product.slug;
  const candidates = [
    path.join(WORKSPACE_ROOT, 'Meta_Reklam_Sistemi', 'campaigns', 'C1-hazir-makineler', 'creatives', slug, 'cutout.png'),
    path.join(WORKSPACE_ROOT, 'Meta_Reklam_Sistemi', 'campaigns', 'C1-hazir-makineler', 'creatives', slug, 'base.png'),
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
  if (genProvider('VIDEO') === 'higgsfield') {
    const local = resolveProductImagePath(product);
    return local ? { imagePath: local, source: 'real' } : { source: 'none' };
  }
  return await productImageUrl(product); // { url, source }
}
