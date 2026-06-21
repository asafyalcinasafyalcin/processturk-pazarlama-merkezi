import { NextResponse } from 'next/server';
import { findProduct } from '@/lib/products';
import { BRAND } from '@/lib/brand';
import { POST as generateCopy } from '@/app/api/generate/copy/route';
import { POST as generateVideo } from '@/app/api/generate/video/route';
import { POST as campaign } from '@/app/api/campaign/route';

export const runtime = 'nodejs';
export const maxDuration = 800; // video istenirse tam pipeline'a yetecek üst sınır

// ── PAZARLAMA TEK GİRİŞ NOKTASI (komut yönlendirici) ──
// "bu ürünle ilgili paylaşım yap"  → action: 'paylasim' → SOSYAL akış
// "bu ürünle ilgili reklam çık"    → action: 'reklam'   → REKLAM akışı
//
// İki akış BAĞIMSIZDIR: biri çalışırken diğerine dokunulmaz. İkisi de aynı kaynaktan
// beslenir — ürün: data/products.json (findProduct), marka: _core/brands/<BRAND_ID>.json
// (lib/brand.js → BRAND). Bu yüzden hangi komut verilirse verilsin aynı ton/kalite korunur.
//
// GÜVENLİK: Bu uç hiçbir DIŞ gönderim/yayın yapmaz ve sürpriz maliyet üretmez.
//  - paylasim: varsayılan yalnız METİN üretir (ucuz, dışa kapalı). Video yalnız
//    options.video === true ise üretilir. Yayın DAİMA /takvim onayından + /api/publish'ten geçer.
//  - reklam: varsayılan yalnız PLAN (dry-run) döner. Gerçek PAUSED kurulum yalnız
//    options.mode === 'create' ile, META_* token + Asaf onayı gerektirir; yayın yine ayrı adımdır.
// (CLAUDE.md "Toplu Gönderim Onayı".)

const ACTION_ALIASES = {
  paylasim: 'paylasim', paylaş: 'paylasim', sosyal: 'paylasim', post: 'paylasim', social: 'paylasim',
  reklam: 'reklam', ad: 'reklam', ads: 'reklam', kampanya: 'reklam',
};

// Mevcut route handler'ını in-process çağır (HTTP self-call yok, mantık tekrarı yok).
async function callRoute(handler, payload) {
  const req = new Request('http://local/internal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const res = await handler(req);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { slug, options = {} } = body;
    const action = ACTION_ALIASES[String(body.action || '').toLowerCase()];

    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    if (!action) {
      return NextResponse.json(
        { ok: false, error: "action geçersiz. Kullan: 'paylasim' (sosyal) veya 'reklam'." },
        { status: 400 },
      );
    }

    // Ortak kaynak teyidi: ürün gerçekten var mı? (iki akış da aynı ürün kaydını okur)
    const product = await findProduct(slug);
    if (!product) return NextResponse.json({ ok: false, error: 'Ürün bulunamadı' }, { status: 404 });
    const brand = { web: BRAND.web, navy: BRAND.navy, whatsapp: BRAND.whatsapp };

    // ── SOSYAL AKIŞ ──
    if (action === 'paylasim') {
      const copyRes = await callRoute(generateCopy, { slug, languages: options.languages });
      if (copyRes.data?.ok === false) {
        return NextResponse.json({ ok: false, action, error: copyRes.data.error }, { status: copyRes.status });
      }
      let video = null;
      if (options.video === true) {
        const videoRes = await callRoute(generateVideo, { slug, lang: options.lang, mode: options.mode });
        if (videoRes.data?.ok === false) {
          return NextResponse.json({ ok: false, action, error: videoRes.data.error }, { status: videoRes.status });
        }
        video = videoRes.data;
      }
      return NextResponse.json({
        ok: true,
        action: 'paylasim',
        slug,
        brand,
        copy: copyRes.data?.copy ?? null,
        video,
        nextSteps: [
          video ? null : "İstersen görsel/video üret: /api/komut { action:'paylasim', options:{ video:true } }",
          '/takvim ekranından öğeyi oluştur ve ONAYLA',
          '/api/publish ile yayınla (LinkedIn/X gerçek; IG/FB/TikTok assisted)',
        ].filter(Boolean),
      });
    }

    // ── REKLAM AKIŞI ──
    // Varsayılan dry-run plan. options.mode === 'create' → gerçek PAUSED kurulum (token gerekir).
    const campRes = await callRoute(campaign, {
      slug,
      langs: options.langs,
      daily: options.daily,
      mode: options.mode,
    });
    if (campRes.data?.ok === false) {
      return NextResponse.json({ ok: false, action, error: campRes.data.error }, { status: campRes.status });
    }
    const created = options.mode === 'create';
    return NextResponse.json({
      ok: true,
      action: 'reklam',
      slug,
      brand,
      mode: created ? 'create' : 'dry-run',
      plan: campRes.data?.plan ?? null,
      nextSteps: created
        ? ['Kampanya PAUSED kuruldu — Meta Ads Manager\'da Asaf onayıyla yayınla']
        : [
            "Creative gerekiyorsa: ürün detayında 'Reklam modu' ile video/görsel üret",
            'META_* token + Asaf onayı hazırsa gerçek PAUSED kurulum: options.mode = "create"',
          ],
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
