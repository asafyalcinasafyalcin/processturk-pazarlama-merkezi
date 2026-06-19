import { NextResponse } from 'next/server';
import { findProduct } from '@/lib/products';
import { buildCopyPrompt } from '@/lib/brand';
import { genStructured } from '@/lib/providers/gen';
import { patchContent } from '@/lib/content';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request) {
  try {
    const { slug, languages } = await request.json();
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });

    const product = await findProduct(slug);
    if (!product) return NextResponse.json({ ok: false, error: 'Ürün bulunamadı' }, { status: 404 });

    const langs = languages?.length ? languages : (product.marketing?.languages || ['tr', 'en']);

    // Dil başına ayrı düz çağrı (güvenilir JSON), sonra by_lang şekline birleştir.
    const perLang = {};
    let highlights = [];
    for (const lang of langs) {
      const { system, prompt } = buildCopyPrompt(product, lang);
      const parsed = await genStructured({ system, prompt });
      if (!parsed?.variants?.length) {
        return NextResponse.json({ ok: false, error: `Metin üretilemedi (${lang}). Tekrar deneyin.` }, { status: 502 });
      }
      perLang[lang] = parsed.variants;
      if (!highlights.length && Array.isArray(parsed.highlights)) highlights = parsed.highlights;
    }

    // by_lang birleştirme: varyantları id'ye göre eşle
    const ids = perLang[langs[0]].map((v) => ({ id: v.id, angle: v.angle }));
    const variants = ids.map(({ id, angle }) => {
      const by_lang = {};
      for (const lang of langs) {
        const v = (perLang[lang].find((x) => x.id === id)) || perLang[lang][ids.findIndex((y) => y.id === id)] || {};
        by_lang[lang] = { headline: v.headline || '', primary: v.primary || '', description: v.description || '', cta: v.cta || '' };
      }
      return { id, angle, by_lang };
    });

    const copy = {
      variants, highlights, languages: langs,
      model: process.env.FAL_LLM_MODEL || 'openai/gpt-4o-mini',
      at: new Date().toISOString(),
    };
    await patchContent(slug, { copy });
    return NextResponse.json({ ok: true, copy });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
