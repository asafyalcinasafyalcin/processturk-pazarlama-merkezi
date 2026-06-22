import { NextResponse } from 'next/server';
import { findProduct } from '@/lib/products';
import { patchContent, getContent } from '@/lib/content';
import { genImage } from '@/lib/providers/gen';
import { resolveProductImagePath } from '@/lib/product-image';
import { findTemplate } from '@/lib/templates';
import { resolveFormat, FAL_TO_HF_RATIO } from '@/lib/platform-format';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request) {
  try {
    const body = await request.json();
    const { slug, template: templateId = 'makine-vitrin', lang = 'tr', platforms = ['instagram'] } = body;

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

    // Soul ID kontrolü (maskot)
    if (template.requiresSoulId) {
      const soulId = process.env.MASKOT_SOUL_ID;
      if (!soulId) {
        return NextResponse.json({
          ok: false,
          error: 'Maskot Soul ID henüz eğitilmedi. MASKOT_SOUL_ID env\'ini ayarlayın.',
          requiresSoulId: true,
        }, { status: 422 });
      }
    }

    // Platform bazlı format seç (sadece seçili platform için)
    const fmt = resolveFormat(platforms);
    const falSize = fmt.falSize;
    const hfRatio = FAL_TO_HF_RATIO[falSize] || '4:5';

    const prompt = template.buildPrompt(product, lang);
    const negativePrompt = template.buildNegativePrompt ? template.buildNegativePrompt() : undefined;

    // Görsel üret (Higgsfield → fal fallback gen.js'te otomatik; prompt-hash cache gen.js'te)
    const result = await genImage({
      prompt,
      negative_prompt: negativePrompt,
      image_size: falSize,      // fal için
      aspect_ratio: hfRatio,   // HF için
      model: 'flux-dev',       // fal default; HF kendi modelini kullanır
      force: body.force,        // cache bypass
    });

    const imageUrl = result.url;
    if (!imageUrl) throw new Error('Görsel URL dönmedi');

    // Ürün gerçek görseli var mı?
    const hasRealImage = Boolean(resolveProductImagePath(product));

    // content.json'a kaydet
    const gorselData = {
      url: imageUrl,
      template: templateId,
      lang,
      platforms,
      format: fmt,
      provider: result.provider,
      model: result.model,
      imageSource: hasRealImage ? 'real' : 'ai-prompt',
      at: new Date().toISOString(),
    };
    await patchContent(slug, { gorsel: gorselData });

    return NextResponse.json({ ok: true, gorsel: gorselData });
  } catch (err) {
    console.error('[generate/gorsel]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
