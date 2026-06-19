import { NextResponse } from 'next/server';
import { listAllAssets, restoreVersion, computeStatus, readPipeline } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

// Bir ürünün tüm dil×aşama sürümleri (varlık kütüphanesi)
export async function GET(request) {
  try {
    const slug = new URL(request.url).searchParams.get('slug');
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    return NextResponse.json({ ok: true, assets: await listAllAssets(slug) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// Eski sürümü geri yükle (yeniden üretim/ücret yok)
export async function POST(request) {
  try {
    const { slug, lang, stage, vid } = await request.json();
    if (!slug || !lang || !stage || !vid) return NextResponse.json({ ok: false, error: 'slug, lang, stage, vid zorunlu' }, { status: 400 });
    const pipe = await restoreVersion(slug, lang, stage, vid);
    return NextResponse.json({ ok: true, status: computeStatus(pipe) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
