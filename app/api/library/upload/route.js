// Kendi hazırladığın görsel/video'yu yükle → kütüphaneye düşer, takvimden paylaşılabilir.
// POST multipart/form-data { slug, file, lang?, caption? }
import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { addToLibrary } from '@/lib/library';

export const runtime = 'nodejs';
export const maxDuration = 120;

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const EXT = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
};

export async function POST(request) {
  try {
    const formData = await request.formData();
    const slug = formData.get('slug');
    const file = formData.get('file');
    const lang = formData.get('lang') || 'tr';
    const caption = formData.get('caption') || '';

    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    if (!file) return NextResponse.json({ ok: false, error: 'file zorunlu' }, { status: 400 });

    const mime = file.type || '';
    const isImage = IMAGE_TYPES.includes(mime);
    const isVideo = VIDEO_TYPES.includes(mime);
    if (!isImage && !isVideo) {
      return NextResponse.json({ ok: false, error: 'Yalnızca görsel (JPG/PNG/WEBP) veya video (MP4/MOV/WEBM) yükleyebilirsiniz.' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), 'public', 'products', slug, 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const fname = `${Date.now()}.${EXT[mime] || 'bin'}`;
    fs.writeFileSync(path.join(dir, fname), buf);

    const localUrl = `/products/${slug}/uploads/${fname}`;
    const type = isVideo ? 'video' : 'gorsel';
    const entry = addToLibrary(slug, type, {
      url: localUrl, localPath: localUrl, lang, caption: caption || null,
      manual: true, imageSource: 'manuel-yükleme', at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, entry, url: localUrl, type });
  } catch (err) {
    console.error('[library/upload]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
