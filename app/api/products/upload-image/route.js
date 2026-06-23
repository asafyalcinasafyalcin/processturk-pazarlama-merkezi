// Ürün fotoğrafı upload endpoint.
// POST /api/products/upload-image
// Body: multipart/form-data { slug, file }
// Kaydeder: public/products/[slug]/base.png
import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const slug = formData.get('slug');
    const file = formData.get('file');

    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    if (!file) return NextResponse.json({ ok: false, error: 'file zorunlu' }, { status: 400 });

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ ok: false, error: 'Yalnızca JPG, PNG veya WEBP yükleyebilirsiniz.' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), 'public', 'products', slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Sharp yoksa doğrudan kaydet; varsa PNG'ye çevir
    const destPath = path.join(dir, 'base.png');
    try {
      const { default: sharp } = await import('sharp');
      await sharp(buf).resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).png().toFile(destPath);
    } catch {
      // Sharp yoksa orijinal içeriği yaz
      fs.writeFileSync(destPath, buf);
    }

    const localUrl = `/products/${slug}/base.png`;
    return NextResponse.json({ ok: true, localUrl, slug });
  } catch (err) {
    console.error('[upload-image]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
