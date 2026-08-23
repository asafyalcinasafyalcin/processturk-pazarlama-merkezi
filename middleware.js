import { NextResponse } from 'next/server';
import { SESSION_COOKIE, isValidSession } from '@/lib/auth';

// Panel bugüne kadar oturumsuzdu (Faz 0 — bkz. lib/auth.js). Bu middleware GİRİŞ dışındaki
// her sayfa/API ucunu korur — istisna listesi kasıtlı DAR tutulur (fail-closed).
//
// ⚠️ `/api/health` LİSTEDE KALMALI: `scripts/deploy-server.sh` deploy sonrası bu uca bakıp
// sağlıklı mı diye karar veriyor. Kapatılınca sağlık kontrolü 401 alır, deploy kendini
// BAŞARISIZ sayıp eski konteynere geri döner — yeni sürüm hiç yayına giremez
// (2026-07-31'de bizzat yaşandı: deploy sessizce rollback etti, canlı eski kodda kaldı).
// Uç yalnız servis durumu döndürür, iş verisi taşımaz.
// ⚠️ `/api/tiktok` LİSTEDE — ama KORUMASIZ DEĞİL. Tek seferlik hesap bağlama akışı
// panel oturumuna bağlıydı ve önünde ÜÇ parola duvarı vardı (SSO + basicauth +
// panel); Asaf geçemedi. Kapı KALKMADI, YER DEĞİŞTİRDİ: rota kendi içinde
// `TIKTOK_BAGLAMA_ANAHTARI` ister ve anahtar tanımlı değilse **503** döner —
// yani env unutulursa uç açık kalmaz, KAPANIR (fail-closed korunur).
// Ayrıca TikTok'un geri dönüşü oturum çerezi taşımayabilir; oturuma bağlı bir
// callback akışı sessizce kırardı.
const ACIK_ONEK = ['/giris', '/api/auth/login', '/api/health', '/api/tiktok'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  if (ACIK_ONEK.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await isValidSession(token)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'Oturum gerekli.' }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = '/giris';
  url.search = '';
  url.searchParams.set('sonra', pathname);
  return NextResponse.redirect(url);
}

// _next statik varlıkları, favicon/icon/manifest ve tüm dosya uzantılı yollar hariç
// HER ŞEY korumalı (sayfalar + api dahil).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)'],
};
