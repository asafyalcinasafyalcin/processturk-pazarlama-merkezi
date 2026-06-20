import { NextResponse } from 'next/server';
import { readConfig, writeConfig, configPath } from '@/lib/reklam';

export const runtime = 'nodejs';

// GET ?slug=... → ürünün hedefleme bloğu (campaign.adsets) + dil metin başlıkları.
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get('slug');
  if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
  const cfg = readConfig(slug);
  if (!cfg) return NextResponse.json({ ok: true, hasConfig: false, adsets: [], languages: {} });
  return NextResponse.json({
    ok: true,
    hasConfig: true,
    adsets: cfg.campaign?.adsets || [],
    languages: cfg.languages || {},
  });
}

// POST { slug, adsets } → config.campaign.adsets güncelle.
export async function POST(request) {
  try {
    const { slug, adsets } = await request.json();
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    if (!configPath(slug)) return NextResponse.json({ ok: false, error: `config yok: ${slug}` }, { status: 400 });
    if (!Array.isArray(adsets)) return NextResponse.json({ ok: false, error: 'adsets dizi olmalı' }, { status: 400 });

    const cfg = readConfig(slug) || {};
    // Temizle: yalnızca geçerli alanlar (lang, countries[], concept).
    const clean = adsets
      .map((a) => ({
        lang: String(a.lang || '').toLowerCase().slice(0, 2),
        countries: Array.isArray(a.countries)
          ? a.countries.map((c) => String(c).toUpperCase().slice(0, 2)).filter(Boolean)
          : String(a.countries || '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean),
        concept: a.concept === 'b' ? 'b' : 'a',
      }))
      .filter((a) => a.lang && a.countries.length);

    cfg.campaign = { ...(cfg.campaign || {}), adsets: clean };
    writeConfig(slug, cfg);
    return NextResponse.json({ ok: true, adsets: clean });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
