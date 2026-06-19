import { NextResponse } from 'next/server';
import { readCalendar, addItem, updateItem, deleteItem } from '@/lib/calendar';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cal = await readCalendar();
    return NextResponse.json({ ok: true, items: cal.items });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.slug || !body.platform) {
      return NextResponse.json({ ok: false, error: 'slug ve platform zorunlu' }, { status: 400 });
    }
    const item = await addItem(body);
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// Durum/zaman güncelleme (örn. onayla: status=approved). Yayın AYRI /api/publish'tedir.
export async function PATCH(request) {
  try {
    const { id, ...patch } = await request.json();
    if (!id) return NextResponse.json({ ok: false, error: 'id zorunlu' }, { status: 400 });
    // Güvenlik: bu uçtan 'published' yapılamaz — yayın yalnızca /api/publish üzerinden.
    if (patch.status === 'published') delete patch.status;
    const item = await updateItem(id, patch);
    if (!item) return NextResponse.json({ ok: false, error: 'Öğe bulunamadı' }, { status: 404 });
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id zorunlu' }, { status: 400 });
    await deleteItem(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
