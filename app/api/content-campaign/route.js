import { NextResponse } from 'next/server';
import { addItem } from '@/lib/calendar';
import { PLATFORMLAR, planZamani } from '@/lib/plan-sabit';

// İÇERİK kampanyası — tek temada N gönderiyi (platform × dil) tek seferde takvime düşürür.
// ⚠️ Mevcut /api/campaign META REKLAM kampanyasıdır (bütçe/hedefleme) — KARIŞTIRMA,
// o uca dokunulmadı.
//
// Hepsi `draft` doğar; onaysız hiçbir şey yayınlanmaz (CLAUDE.md toplu gönderim kuralı).
export const runtime = 'nodejs';

const GECERLI_PLATFORM = new Set(PLATFORMLAR.map((p) => p.id));

export async function POST(request) {
  try {
    const body = await request.json();
    const { tema, slug, platformlar, diller, medya = [], baslangic, linkedinKimlikler = [] } = body;

    if (!tema?.trim()) return NextResponse.json({ ok: false, error: 'Kampanya adı zorunlu' }, { status: 400 });
    if (!Array.isArray(platformlar) || platformlar.length === 0) {
      return NextResponse.json({ ok: false, error: 'En az bir platform seçin' }, { status: 400 });
    }
    const gecersiz = platformlar.filter((p) => !GECERLI_PLATFORM.has(p));
    if (gecersiz.length) return NextResponse.json({ ok: false, error: `Bilinmeyen platform: ${gecersiz.join(', ')}` }, { status: 400 });
    if (!Array.isArray(diller) || diller.length === 0) {
      return NextResponse.json({ ok: false, error: 'En az bir dil seçin' }, { status: 400 });
    }

    // medya: [{ lang, caption, imageUrl, videoUrl }] — dil başına içerik.
    // Dile karşılık gelen kayıt yoksa ilk kayıt ortak içerik olarak kullanılır.
    const medyaByLang = {};
    for (const m of medya) if (m?.lang) medyaByLang[m.lang] = m;
    const ortak = medya[0] || {};

    const baslangicTarihi = baslangic ? new Date(baslangic) : new Date(Date.now() + 24 * 3600 * 1000);
    if (Number.isNaN(baslangicTarihi.getTime())) {
      return NextResponse.json({ ok: false, error: 'Başlangıç tarihi geçersiz' }, { status: 400 });
    }

    // LinkedIn seçiliyse hangi kimlik(ler)e gideceği açıkça belirtilmeli — geçilmezse
    // Sosyal Yayın Servisi kendi varsayılanına düşer (yanlış hesaptan yayın riski).
    const liKimlikler = platformlar.includes('linkedin')
      ? (linkedinKimlikler.length ? linkedinKimlikler : ['organization'])
      : [];

    const olusturulan = [];
    let i = 0;
    // Dil dış döngü: aynı dilin farklı platformları arka arkaya gitmez, diller dönüşümlü
    // dağılır → tek hesapta aynı gün aynı dilden yığılma olmaz.
    for (const dil of diller) {
      for (const platform of platformlar) {
        const m = medyaByLang[dil] || ortak;
        // LinkedIn'de seçilen her kimlik AYRI gönderidir (şirket + kişisel = 2 post).
        const kimlikler = platform === 'linkedin' ? liKimlikler : [null];
        for (const kimlik of kimlikler) {
          const item = await addItem({
            slug: slug?.trim() || `kampanya-${tema.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
            platform,
            lang: dil,
            caption: m.caption || '',
            imageUrl: m.imageUrl || '',
            videoUrl: m.videoUrl || '',
            scheduledAt: planZamani(baslangicTarihi, i),
            variantId: tema.trim().slice(0, 40),
            ...(kimlik ? { publishAs: kimlik } : {}),
          });
          olusturulan.push(item);
          i++;
        }
      }
    }

    return NextResponse.json({ ok: true, adet: olusturulan.length, items: olusturulan });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
