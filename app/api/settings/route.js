import { NextResponse } from 'next/server';
import { readSettings, patchSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try { return NextResponse.json({ ok: true, settings: await readSettings() }); }
  catch (err) { return NextResponse.json({ ok: false, error: err.message }, { status: 500 }); }
}

export async function PATCH(request) {
  try {
    const patch = await request.json();
    const allowed = {};
    for (const k of ['brandVoice', 'brandPreset', 'pronounce', 'generationMode']) if (k in patch) allowed[k] = patch[k];
    return NextResponse.json({ ok: true, settings: await patchSettings(allowed) });
  } catch (err) { return NextResponse.json({ ok: false, error: err.message }, { status: 500 }); }
}
