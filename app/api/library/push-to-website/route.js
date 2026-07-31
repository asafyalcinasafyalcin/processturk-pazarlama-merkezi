import { NextResponse } from 'next/server';
import { siteyeMedyaGonder, koprüHazir } from '@/lib/site-koprusu';

// Paneldeki bir görsel/videoyu SİTENİN medya kütüphanesine gönder.
// Site dosyayı kendisi indirir (URL geçilir, bayt POST edilmez) — büyük video için
// bellek şişmesi olmaz ve site kendi boyut/tür sınırını uygular.
export const runtime = 'nodejs';
export const maxDuration = 120;

// Site dışarıdan erişebilsin diye medya URL'i MUTLAK olmalı. Panelin kendi
// /api/media/... yolu görelidir → PUBLIC_URL ile mutlaklaştırılır.
function mutlakUrl(u) {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  const taban = process.env.PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  return taban ? `${taban.replace(/\/$/, '')}${u}` : '';
}

export async function POST(request) {
  try {
    if (!koprüHazir()) {
      return NextResponse.json({ ok: false, error: 'Site köprüsü kapalı — PAZARLAMA_API_KEY tanımlı değil.' }, { status: 409 });
    }
    const { url, ad, etiket } = await request.json();
    const tam = mutlakUrl(url);
    if (!tam) {
      return NextResponse.json({
        ok: false,
        error: 'Medya adresi mutlaklaştırılamadı — PUBLIC_URL tanımlı olmalı (site dosyayı dışarıdan indirir).',
      }, { status: 400 });
    }
    const sonuc = await siteyeMedyaGonder({ url: tam, ad, etiket });
    return NextResponse.json({ ok: true, siteUrl: sonuc.url, id: sonuc.id });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 502 });
  }
}
