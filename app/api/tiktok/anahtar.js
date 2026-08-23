import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

/**
 * TIKTOK UÇLARININ TEK KAPISI — bağlantının KENDİSİ kimlik belgesidir.
 *
 * 🔴 NEDEN BÖYLE: bu akış tek seferliktir ve önünde üç parola duvarı vardı
 *    (shared-auth SSO · Traefik basicauth · panel oturumu). Asaf geçemedi —
 *    tasarım hatası bizdeydi: tek seferlik bir kuruluma kalıcı panel kimliği
 *    dayatmak. Kapı KALKMADI, YER DEĞİŞTİRDİ.
 *
 * ⛔ FAIL-CLOSED: `TIKTOK_BAGLAMA_ANAHTARI` tanımlı DEĞİLSE uç **503** döner.
 *    Env unutulursa kapı açık kalmaz, kapanır. (Middleware istisnası bu garantiye
 *    dayanıyor — ikisi birlikte okunmalı.)
 *
 * ⚠️ Karşılaştırma SABİT ZAMANLI: `===` cevap süresinden karakter sızdırır.
 */
export function anahtarKapisi(req) {
  const beklenen = process.env.TIKTOK_BAGLAMA_ANAHTARI;
  if (!beklenen || beklenen.length < 24) {
    return NextResponse.json(
      { ok: false, hata: 'TIKTOK_BAGLAMA_ANAHTARI tanımlı değil (ya da çok kısa) — '
        + 'uç bilerek KAPALI. Merkezi .env.local\'e ekleyip sirlari-dagit.mjs --uygula koş.' },
      { status: 503 },
    );
  }
  const gelen = new URL(req.url).searchParams.get('anahtar')
    ?? req.cookies.get('tt_anahtar')?.value ?? '';
  const a = Buffer.from(gelen);
  const b = Buffer.from(beklenen);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json(
      { ok: false, hata: 'anahtar geçersiz — bağlantıyı Claude\'un verdiği hâliyle aç.' },
      { status: 401 },
    );
  }
  return null;                                     // null = geçti
}
