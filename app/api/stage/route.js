import { NextResponse } from 'next/server';
import { readPipeline, computeStatus } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const u = new URL(request.url);
    const slug = u.searchParams.get('slug');
    const lang = u.searchParams.get('lang') || 'tr';
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    const pipe = await readPipeline(slug, lang);
    return NextResponse.json({ ok: true, lang, pipeline: pipe, status: computeStatus(pipe) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
