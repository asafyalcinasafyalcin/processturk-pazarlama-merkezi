import { NextResponse } from 'next/server';
import { listAllAssets, restoreVersion, computeStatus, readPipeline } from '@/lib/pipeline';
import { listLibrary } from '@/lib/library';

export const dynamic = 'force-dynamic';

// Bir ürünün tüm dil×aşama sürümleri (varlık kütüphanesi)
export async function GET(request) {
  try {
    const slug = new URL(request.url).searchParams.get('slug');
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    const pipelineAssets = await listAllAssets(slug);
    // Görsel kütüphanesi (pipeline dışı üretimler — Görsel Sekmesinden üretilenler)
    const libEntries = listLibrary(slug).map((e) => ({
      lang: e.lang || 'tr',
      stage: 'gorsel',
      vid: `lib-${e.at}`,
      at: e.at,
      cost: 0,
      note: `${e.template || ''} · ${e.imageSource || ''}`,
      isCurrent: false,
      url: e.localPath || e.url,
      localPath: e.localPath || null,
      summary: e.template,
    }));
    return NextResponse.json({ ok: true, assets: [...pipelineAssets, ...libEntries] });
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
