// Reklam kampanyası creative'lerini (reklam/campaigns/<C>/creatives/<slug>/) panelin Varlık
// Kütüphanesi'ne elle çek. Ürün sayfası açılışında zaten otomatik çalışır; bu manuel tetikleyici.
import { NextResponse } from 'next/server';
import { syncReklamCreatives } from '@/lib/reklam-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { slug } = await request.json();
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    const res = await syncReklamCreatives(slug);
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    console.error('[reklam-sync]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
