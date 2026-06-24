import { NextResponse } from 'next/server';
import { listLibrary, deleteFromLibrary, setArchived } from '@/lib/library';

export const dynamic = 'force-dynamic';

// Bir ürünün varlık kütüphanesi — üretilen tüm görsel/video/ses/metin sürümleri.
// Tek kaynak: data/library.json (pipeline'dan bağımsız).
// Varsayılan: arşivlenmiş içerik gizlenir (?includeArchived=1 ile döner).
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');
    const includeArchived = url.searchParams.get('includeArchived') === '1';
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    const entries = listLibrary(slug)
      .filter((e) => includeArchived || !e.archived)
      .map((e) => ({
        id: e.id || e.at,
        type: e.type || 'gorsel',
        // Eski AssetLibrary alan adlarıyla uyum (stage)
        stage: e.type || 'gorsel',
        lang: e.lang || 'tr',
        at: e.at,
        url: e.url || null,
        localPath: e.localPath || null,
        template: e.template || null,
        concept: e.concept || null,
        imageSource: e.imageSource || null,
        voiceUrl: e.voiceUrl || null,
        caption: e.caption || null,
        text: e.text || null,
        platform: e.platform || null,
        model: e.model || null,
        manual: Boolean(e.manual),
        archived: Boolean(e.archived),
      }));
    return NextResponse.json({ ok: true, assets: entries });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// Arşivle / arşivden çıkar (silmeden gizle)
export async function PATCH(request) {
  try {
    const { id, archived } = await request.json();
    if (!id) return NextResponse.json({ ok: false, error: 'id zorunlu' }, { status: 400 });
    const changed = setArchived(id, archived);
    return NextResponse.json({ ok: true, changed });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// Bir kütüphane kaydını kalıcı sil
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
