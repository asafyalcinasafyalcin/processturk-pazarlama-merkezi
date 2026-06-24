import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { findProduct } from '@/lib/products';
import { patchContent, getContent } from '@/lib/content';
import { genImage } from '@/lib/providers/gen';
import { resolveProductImagePath } from '@/lib/product-image';
import { findTemplate } from '@/lib/templates';
import { resolveFormat, FAL_TO_HF_RATIO } from '@/lib/platform-format';
import { downloadAndSave } from '@/lib/download-asset';
import { addToLibrary } from '@/lib/library';

function loadMaskotConfig() {
  try {
    const p = join(process.cwd(), '..', '_core', 'maskot', 'soul-id.json');
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return { status: 'not-trained', reference_id: null };
  }
}

const MASKOT_REFERENCE_IMG = join(process.cwd(), '..', '_core', 'maskot', 'mascot-wave.png');

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request) {
  try {
    const body = await request.json();
    const { slug, template: templateId = 'makine-vitrin', lang = 'tr', platforms = ['instagram'], concept = null } = body;

    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });

    const product = await findProduct(slug);
    if (!product) return NextResponse.json({ ok: false, error: 'Ürün bulunamadı' }, { status: 404 });

    // Slug cache: aynı slug+template+lang için ≤7 günlük sonuç varsa tekrar üretme.
    // force:true ile aşılır (gen.js prompt-hash cache da devre dışı kalır).
    if (!body.force) {
      const existing = await getContent(slug);
      const g = existing?.gorsel;
      if (g?.url && g.template === templateId && g.lang === lang) {
        const ageDays = (Date.now() - new Date(g.at).getTime()) / 86400000;
        if (ageDays < 7) return NextResponse.json({ ok: true, gorsel: g, fromCache: true });
      }
    }

    const template = findTemplate(templateId);

    // Soul ID / maskot referans kontrolü
    let maskotSoulId = null;
    let maskotReferenceImage = null;
    if (template.requiresSoulId) {
      const envSoulId = process.env.MASKOT_SOUL_ID;
      const fileConfig = loadMaskotConfig();
      maskotSoulId = envSoulId || (fileConfig.status === 'ready' ? fileConfig.reference_id : null);
      if (!maskotSoulId) {
        // Soul ID henüz yok → fallback: nano_banana_2_pro + referans görsel
        maskotReferenceImage = MASKOT_REFERENCE_IMG;
      }
    }

    // Platform bazlı format seç (sadece seçili platform için)
    const fmt = resolveFormat(platforms);
    const falSize = fmt.falSize;
    const hfRatio = FAL_TO_HF_RATIO[falSize] || '4:5';

    const prompt = template.buildPrompt(product, lang);
    const negativePrompt = template.buildNegativePrompt ? template.buildNegativePrompt() : undefined;

    // Img2img: Asaf'ın yüklediği makine fotoğrafı varsa bunu kaynak olarak kullan.
    // Makine yapısı/detayları korunur, yalnızca arka plan/ışık değişir.
    // NOT: yerel dosya yolu verilir; gen.js bunu fal.storage'a yükleyip public URL'e çevirir
    // (HF native upload 403/"Forbidden" sorununu baypas eder, fal fallback'i de besler).
    const uploadedBase = join(process.cwd(), 'public', 'products', slug, 'base.png');
    const hasUploadedImage = existsSync(uploadedBase);

    const result = await genImage({
      prompt,
      negative_prompt: negativePrompt,
      image_size: falSize,
      aspect_ratio: hfRatio,
      model: 'flux-schnell',
      force: body.force,
      ...(maskotSoulId && { soul_id: maskotSoulId }),
      ...(maskotReferenceImage && !hasUploadedImage && { reference_image: maskotReferenceImage }),
      ...(hasUploadedImage && !maskotSoulId && { reference_image: uploadedBase }),
    });

    const cdnUrl = result.url;
    if (!cdnUrl) throw new Error('Görsel URL dönmedi');

    // Yerel kopyala — CDN URL'ler expire olur; panel localPath'ten okur
    const { localPath } = await downloadAndSave(cdnUrl, slug, 'gorsel');

    const hasRealImage = Boolean(resolveProductImagePath(product));

    const gorselData = {
      url: cdnUrl,
      localPath: localPath || null,
      template: templateId,
      concept,
      lang,
      platforms,
      format: fmt,
      provider: result.provider,
      model: result.model,
      imageSource: hasUploadedImage ? 'img2img' : (hasRealImage ? 'real' : 'ai-prompt'),
      at: new Date().toISOString(),
    };
    await patchContent(slug, { gorsel: gorselData });

    // Kütüphaneye ekle — her üretim kaydedilir, öncekiler silinmez
    addToLibrary(slug, 'gorsel', gorselData);

    return NextResponse.json({ ok: true, gorsel: gorselData });
  } catch (err) {
    console.error('[generate/gorsel]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
