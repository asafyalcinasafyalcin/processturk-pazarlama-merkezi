import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateImage } from '@/lib/providers/higgsfield';

export const runtime = 'nodejs';
export const maxDuration = 180;

// _core/maskot/soul-id.json — workspace kökünde, uygulamanın bir üst üstünde
const SOUL_ID_PATH = join(process.cwd(), '..', '_core', 'maskot', 'soul-id.json');
const MASKOT_IMG_PATH = join(process.cwd(), '..', '_core', 'maskot', 'mascot-wave.png');

function loadSoulConfig() {
  try {
    return JSON.parse(readFileSync(SOUL_ID_PATH, 'utf8'));
  } catch {
    return { status: 'not-trained', reference_id: null };
  }
}

export async function GET() {
  const config = loadSoulConfig();
  return NextResponse.json({ ok: true, maskot: config });
}

export async function POST(request) {
  try {
    const { prompt, aspect_ratio = '3:4', force = false } = await request.json();

    if (!prompt) return NextResponse.json({ ok: false, error: 'prompt zorunlu' }, { status: 400 });

    const config = loadSoulConfig();
    let result;

    if (config.status === 'ready' && config.reference_id) {
      // Soul ID ile üret
      result = await generateImage({ prompt, aspect_ratio, soul_id: config.reference_id });
    } else {
      // Fallback: nano_banana_2_pro + referans görsel
      result = await generateImage({
        prompt,
        aspect_ratio,
        reference_image: MASKOT_IMG_PATH,
      });
    }

    return NextResponse.json({
      ok: true,
      url: result.url,
      model: result.model,
      mode: config.status === 'ready' ? 'soul-id' : 'reference-image',
      soul_status: config.status,
    });
  } catch (err) {
    console.error('[generate/maskot]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
