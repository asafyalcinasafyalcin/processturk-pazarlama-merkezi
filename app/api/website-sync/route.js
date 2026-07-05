import { NextResponse } from 'next/server';
import { syncWebsiteProducts, getWebsiteSyncStatus } from '@/lib/website-sync';

export const dynamic = 'force-dynamic';

// Durum: son eşitleme zamanı + özet.
export async function GET() {
  return NextResponse.json({ ok: true, ...getWebsiteSyncStatus() });
}

// Elle "Şimdi Eşitle" — TTL beklemeden tam tur (görsel bütçesi geniş).
export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch { /* gövdesiz çağrı */ }
  try {
    const result = await syncWebsiteProducts({
      force: body.force !== false,
      maxImageDownloads: Number(body.maxImageDownloads) || 20,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
