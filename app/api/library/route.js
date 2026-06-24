import { NextResponse } from 'next/server';
import { listAllLibrary, deleteFromLibrary } from '@/lib/library';
import { readProducts } from '@/lib/products';

export const dynamic = 'force-dynamic';

// Genel arşiv — tüm ürünlerin üretilmiş/yüklenmiş tüm içerikleri (görsel/video/ses/metin).
export async function GET() {
  try {
    const products = await readProducts();
    const nameBySlug = {};
    for (const p of products) nameBySlug[p.slug] = p.marketing?.name_tr || p.name_en || p.slug;

    const entries = listAllLibrary().map((e) => ({
      id: e.id || e.at,
      slug: e.slug,
      productName: nameBySlug[e.slug] || e.slug,
      type: e.type || 'gorsel',
      lang: e.lang || 'tr',
      at: e.at,
      url: e.url || null,
      localPath: e.localPath || null,
      template: e.template || null,
      concept: e.concept || null,
      platform: e.platform || null,
      caption: e.caption || e.text || null,
      voiceUrl: e.voiceUrl || null,
      model: e.model || null,
      manual: Boolean(e.manual),
    }));

    return NextResponse.json({ ok: true, entries });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ ok: false, error: 'id zorunlu' }, { status: 400 });
    const removed = deleteFromLibrary(id);
    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
