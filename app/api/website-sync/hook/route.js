import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { syncWebsiteProducts } from '@/lib/website-sync';

export const dynamic = 'force-dynamic';

// Web sitesi → panel "anında eşitle" webhook'u. Site admin'de ürün/kategori kaydedilince
// (Processturk_Web_Sitesi/src/lib/notify-pazarlama.ts) çağrılır; 10 dk TTL'yi atlar.
//
// Güvenlik: WEBSITE_SYNC_SECRET env ile paylaşılan anahtar (x-sync-secret header veya ?secret=).
// Bu route, panel basic-auth'unun DIŞINDA erişilebilir olacak şekilde tasarlandı (Traefik'te
// /api/website-sync/hook için auth'suz router — /api/media kalıbı). Secret set edilmemişse
// güvenli tarafta kalmak için 503 döner (yanlışlıkla herkese açık kalmasın).

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export async function POST(request) {
  const secret = process.env.WEBSITE_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'Webhook kapalı (WEBSITE_SYNC_SECRET tanımsız).' }, { status: 503 });
  }
  const provided = request.headers.get('x-sync-secret')
    || new URL(request.url).searchParams.get('secret')
    || '';
  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ ok: false, error: 'Geçersiz anahtar.' }, { status: 401 });
  }

  try {
    // force:true → TTL atla; görsel bütçesi orta (webhook sık gelebilir, kalanı sonraki tur alır).
    const result = await syncWebsiteProducts({ force: true, maxImageDownloads: 12 });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
