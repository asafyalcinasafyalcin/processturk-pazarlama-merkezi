import { NextResponse } from 'next/server';
import { readSettings, patchSettings } from '@/lib/settings';
import { resolveTier } from '@/lib/quality-tiers';

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
    // Kalite tier'ları: geçersiz değer sessizce en ucuza kaçmasın → resolveTier normalize eder.
    for (const k of ['imageTier', 'videoTier']) if (k in patch) allowed[k] = resolveTier(patch[k]).tier;
    return NextResponse.json({ ok: true, settings: await patchSettings(allowed) });
  } catch (err) { return NextResponse.json({ ok: false, error: err.message }, { status: 500 }); }
}
