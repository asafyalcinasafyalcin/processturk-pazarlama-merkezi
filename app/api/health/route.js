import { NextResponse } from 'next/server';

// Deploy sağlık kontrolü (container içinden çağrılır; Traefik basic-auth'u bypass eder).
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ok: true, service: 'pazarlama-merkezi', time: new Date().toISOString() });
}
