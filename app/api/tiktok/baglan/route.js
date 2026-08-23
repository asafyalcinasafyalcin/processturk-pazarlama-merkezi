import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { anahtarKapisi } from '../anahtar';

export const dynamic = 'force-dynamic';

/**
 * TIKTOK HESAP BAĞLAMA — 1. adım: yetkilendirme sayfasına yollar.
 *
 * 🔑 NEDEN BU VAR: TikTok yayını için üç şey gerekiyor ve ÖLÇÜLDÜ (23.08.2026) —
 *    ① uygulama YAŞIYOR ve client anahtarları GEÇERLİ (`client_credentials` → HTTP 200)
 *    ② `TIKTOK_ACCESS_TOKEN` / `REFRESH_TOKEN` / `OPEN_ID` **BOŞ**
 *    ③ bunlar yalnız KULLANICI onayıyla doğar → tarayıcı gerekir, Claude yapamaz.
 *    Bu uç, Asaf'ın işini "geliştirici portalında dolaş"tan "bir bağlantıya tıkla"ya
 *    indirir.
 *
 * ⛔ KORUMA: panel middleware'i bu ucu zaten oturuma bağlıyor (`middleware.js`
 *    istisna listesinde DEĞİL) — istisna EKLENMEZ. TikTok geri dönüşü de aynı
 *    tarayıcıdan geldiği için oturum çerezi callback'e ulaşır.
 *
 * ⚠️ ÖNKOŞUL (Asaf, TikTok geliştirici portalı): Redirect URI olarak
 *    `https://pazarlama.processturk.com/api/tiktok/callback` KAYITLI olmalı.
 *    Kayıtlı değilse TikTok `redirect_uri` hatası verir — bu da bir ÖLÇÜMDÜR.
 */
export async function GET(req) {
  const kapi = anahtarKapisi(req);
  if (kapi) return kapi;
  const key = process.env.TIKTOK_CLIENT_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, hata: 'TIKTOK_CLIENT_KEY yok — merkezi .env.local eksik.' },
      { status: 500 },
    );
  }
  const taban = new URL(req.url).origin;
  const redirect = process.env.TIKTOK_REDIRECT_URI || `${taban}/api/tiktok/callback`;
  // CSRF: `state` çerezle eşleşecek; callback doğrular.
  const state = randomBytes(16).toString('hex');

  const u = new URL('https://www.tiktok.com/v2/auth/authorize/');
  u.searchParams.set('client_key', key);
  // ⚠️ KAPSAMLAR: `video.publish` uygulama incelemesinden GEÇMİŞ olmalı. Geçmemişse
  //    TikTok onay ekranında hata verir — hangi kapsamın eksik olduğunu O SÖYLER.
  u.searchParams.set('scope', 'user.info.basic,video.publish,video.upload');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', redirect);
  u.searchParams.set('state', state);

  const res = NextResponse.redirect(u.toString());
  const cerez = { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 900, path: '/api/tiktok' };
  res.cookies.set('tt_state', state, cerez);
  // ⚠️ ANAHTAR ÇEREZE DE YAZILIR: TikTok geri dönerken YALNIZ `code` ve `state`
  //    taşır — bizim `?anahtar` parametremiz kaybolur. Çerez olmadan callback
  //    kendi kapısından geçemez ve akış son adımda kırılırdı.
  //    `sameSite: lax` üst-düzey GET yönlendirmesinde gönderilir → TikTok'tan
  //    dönüşte çerez gelir. `path` dar tutuldu: yalnız bu uç ailesi görür.
  res.cookies.set('tt_anahtar', process.env.TIKTOK_BAGLAMA_ANAHTARI, cerez);
  return res;
}
