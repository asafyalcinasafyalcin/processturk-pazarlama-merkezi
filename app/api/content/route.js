import { NextResponse } from 'next/server';
import { readAllContent, getContent, patchContent } from '@/lib/content';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const slug = new URL(request.url).searchParams.get('slug');
    if (slug) return NextResponse.json({ ok: true, content: await getContent(slug) });
    return NextResponse.json({ ok: true, all: await readAllContent() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// Taslak düzenleme: copy (varyant metinleri/highlights) veya scriptPlan'i Asaf düzenleyip kaydeder.
export async function PATCH(request) {
  try {
    const { slug, copy, scriptPlan } = await request.json();
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    const patch = {};
    if (copy) patch.copy = copy;
    if (scriptPlan) patch.scriptPlan = scriptPlan;
    if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: 'copy veya scriptPlan gerekli' }, { status: 400 });
    const updated = await patchContent(slug, patch);
    return NextResponse.json({ ok: true, content: updated });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
