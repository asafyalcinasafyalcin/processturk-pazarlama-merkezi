import { NextResponse } from 'next/server';
import { findProduct } from '@/lib/products';
import { patchContent } from '@/lib/content';
import { generatePostText } from '@/lib/post-text';
import { addToLibrary } from '@/lib/library';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json();
    const { slug, lang = 'tr', platforms = ['instagram'], template: templateId = 'makine-vitrin', concept = 'tanitim' } = body;

    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });

    const product = await findProduct(slug);
    if (!product) return NextResponse.json({ ok: false, error: 'Ürün bulunamadı' }, { status: 404 });

    // Platform-spesifik caption + hashtag üret
    const texts = await generatePostText({ product, platforms, lang, templateId, concept });

    // content.json'a kaydet
    const metinData = { texts, lang, platforms, template: templateId, at: new Date().toISOString() };
    await patchContent(slug, { metin: metinData });

    // Kütüphaneye platform başına metin kaydı ekle
    for (const platform of platforms) {
      const pt = texts[platform];
      if (pt?.caption) {
        const caption = pt.hashtags?.length ? `${pt.caption}\n\n${pt.hashtags.join(' ')}` : pt.caption;
        addToLibrary(slug, 'metin', { lang, platform, caption, concept: body.concept || null, at: new Date().toISOString() });
      }
    }

    return NextResponse.json({ ok: true, texts, lang, platforms });
  } catch (err) {
    console.error('[generate/metin]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
