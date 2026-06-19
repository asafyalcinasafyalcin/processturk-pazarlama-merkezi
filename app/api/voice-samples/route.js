import { NextResponse } from 'next/server';
import { genVoice, voiceCandidates } from '@/lib/providers/gen';
import { normalizeForTTS } from '@/lib/tts-normalize';
import { readSettings } from '@/lib/settings';

export const runtime = 'nodejs';
export const maxDuration = 180;

// Aynı kısa TR cümleyi aday seslerle üretir → Asaf dinleyip marka sesini seçer.
const SAMPLE_TR = 'ProcessTürk ile baharatı, kuruyemişi ve granülü saatte 1.000 adede kadar doldurun. Kurulumdan sonra 7/24 uzaktan destek yanınızda.';

export async function POST() {
  try {
    const settings = await readSettings();
    const text = normalizeForTTS(SAMPLE_TR, 'tr', settings.pronounce);
    const samples = [];
    for (const c of voiceCandidates()) {
      try {
        const v = await genVoice({ text, voice: c.id, voiceId: c.id, preset: c.preset });
        samples.push({ id: c.id, label: c.label, preset: c.preset, url: v.url });
      } catch (e) {
        samples.push({ id: c.id, label: c.label, preset: c.preset, error: e.message });
      }
    }
    return NextResponse.json({ ok: true, spokenText: text, samples });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
