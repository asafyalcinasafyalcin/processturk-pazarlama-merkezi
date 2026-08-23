import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * TIKTOK HESAP BAĞLAMA — 2. adım: `code` → token değişimi.
 *
 * ⛔ TOKEN DOSYAYA YAZILMAZ. Konteynerin `.env.local`i EFEMERDİR; oraya yazmak
 *    ilk deploy'da sessizce kaybolur ve "bağladık" sanılır. Sırların TEK EVİ
 *    `agents/icerik-ajani/app/.env.local`, dağıtıcısı `sirlari-dagit.mjs`
 *    (CLAUDE.md §Sır yönetimi). Bu uç token'ı EKRANDA verir; Asaf merkezi dosyaya
 *    yapıştırır ve dağıtıcıyı koşar. Tek kaynak korunur.
 *
 * ⛔ CSRF: `state` çerezle KARŞILAŞTIRILIR. Eşleşmezse token DEĞİŞİMİ YAPILMAZ.
 */
export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const hata = url.searchParams.get('error');
  const hataAcik = url.searchParams.get('error_description');

  if (hata) {
    // 🔑 Bu bir BAŞARISIZLIK DEĞİL, ÖLÇÜMDÜR: TikTok hangi kapsamın/ayarın eksik
    //    olduğunu burada söyler. Mesajı yutma, aynen göster.
    return NextResponse.json(
      { ok: false, asama: 'TikTok onay ekranı', hata, aciklama: hataAcik,
        not: 'Kapsam onayı ya da redirect_uri kaydı eksik olabilir — mesaj TikTok\'un.' },
      { status: 400 },
    );
  }
  if (!code) return NextResponse.json({ ok: false, hata: 'code yok' }, { status: 400 });

  const bekleyen = req.cookies.get('tt_state')?.value;
  if (!bekleyen || bekleyen !== state) {
    return NextResponse.json(
      { ok: false, hata: 'state uyuşmuyor — akış bu tarayıcıda başlatılmamış.' },
      { status: 400 },
    );
  }

  const redirect = process.env.TIKTOK_REDIRECT_URI || `${url.origin}/api/tiktok/callback`;
  const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code, grant_type: 'authorization_code', redirect_uri: redirect,
    }),
  });
  const d = await r.json();
  if (!d.access_token) {
    return NextResponse.json(
      { ok: false, asama: 'token değişimi', durum: r.status, cevap: d },
      { status: 400 },
    );
  }

  // ⚠️ Token EKRANDA gösterilir (oturumlu, kendi tarayıcısı) ama LOGA BASILMAZ:
  //    2026-07-29 sızıntısı tam olarak serbest-metin alanından olmuştu.
  return NextResponse.json({
    ok: true,
    yapilacak: 'Aşağıdaki üç satırı agents/icerik-ajani/app/.env.local dosyasına '
      + 'yaz, sonra: node Temel_Sistemler/sirlari-dagit.mjs --uygula',
    satirlar: [
      `TIKTOK_ACCESS_TOKEN=${d.access_token}`,
      `TIKTOK_REFRESH_TOKEN=${d.refresh_token ?? ''}`,
      `TIKTOK_OPEN_ID=${d.open_id ?? ''}`,
    ],
    kapsamlar: d.scope,
    gecerlilik_sn: d.expires_in,
    uyari: 'Bu sayfayı kimseyle paylaşma; token burada AÇIK. Kopyaladıktan sonra kapat.',
  });
}
