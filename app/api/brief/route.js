// Brief CRUD endpoint.
// GET  /api/brief?slug=granul-dolum
// POST /api/brief  { slug, highlights, target_industries, ideal_customer, pain_points, dont_say, image_notes, approved }
import { NextResponse } from 'next/server';
import { readBrief, writeBrief } from '@/lib/brief';

export const runtime = 'nodejs';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
  const brief = readBrief(slug);
  return NextResponse.json({ ok: true, brief });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { slug, ...fields } = body;
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    const saved = writeBrief(slug, fields);
    return NextResponse.json({ ok: true, brief: saved });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
