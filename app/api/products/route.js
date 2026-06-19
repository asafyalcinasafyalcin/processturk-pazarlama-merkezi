import { NextResponse } from 'next/server';
import { readProducts, addProduct } from '@/lib/products';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await readProducts();
    return NextResponse.json({ ok: true, count: products.length, products });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    if (!payload?.name_tr && !payload?.name_en) {
      return NextResponse.json({ ok: false, error: 'Ürün adı (TR veya EN) zorunlu.' }, { status: 400 });
    }
    const record = await addProduct(payload);
    return NextResponse.json({ ok: true, product: record });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
