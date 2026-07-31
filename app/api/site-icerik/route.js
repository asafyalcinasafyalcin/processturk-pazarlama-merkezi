import { NextResponse } from 'next/server';
import { siteIcerigiGetir, koprüHazir, siteTabani } from '@/lib/site-koprusu';

// Sitedeki içeriğin AYNASI — salt-okunur. Panel burada hiçbir şey saklamaz, her istekte
// siteden taze çeker (tek kaynak site kalır, kopya sapması olmaz).
export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!koprüHazir()) {
    return NextResponse.json({
      ok: false,
      kapali: true,
      error: 'Site köprüsü kapalı — PAZARLAMA_API_KEY her iki tarafta da tanımlı olmalı.',
      taban: siteTabani(),
    });
  }
  try {
    const limit = Number(new URL(request.url).searchParams.get('limit')) || 60;
    const veri = await siteIcerigiGetir(limit);
    return NextResponse.json({ ok: true, taban: siteTabani(), ...veri });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message, taban: siteTabani() }, { status: 502 });
  }
}
