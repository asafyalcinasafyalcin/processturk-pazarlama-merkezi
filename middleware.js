import { NextResponse } from 'next/server';
import { SESSION_COOKIE, isValidSession } from '@/lib/auth';

// Panel bugüne kadar oturumsuzdu (Faz 0 — bkz. lib/auth.js). Bu middleware GİRİŞ dışındaki
// her sayfa/API ucunu korur — istisna listesi kasıtlı DAR tutulur (fail-closed).
const ACIK_ONEK = ['/giris', '/api/auth/login'];

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
