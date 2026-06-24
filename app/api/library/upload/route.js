// Kendi hazırladığın görsel/video'yu yükle → kütüphaneye düşer, takvimden paylaşılabilir.
// POST multipart/form-data { slug, file, lang?, caption? }
//
// Medya data/uploads'a (kalıcı mount) yazılır ve /api/media/<dosya> ile servis edilir —
// public/ çalışma-zamanı yazımı canlıda sunulmadığı için (bkz. lib/media-store.js).
import { NextResponse } from 'next/server';
import { addToLibrary } from '@/lib/library';
import { saveBuffer } from '@/lib/media-store';
import { patchContent } from '@/lib/content';

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
    const type = isVideo ? 'video' : 'gorsel';
    const { servedUrl } = saveBuffer(buf, { slug, type, ext: EXT[mime] || 'bin' });

    const at = new Date().toISOString();
    const entry = addToLibrary(slug, type, {
      url: servedUrl, localPath: servedUrl, lang, caption: caption || null,
      manual: true, imageSource: 'manuel-yükleme', at,
    });

    // Yüklenen medyayı ürünün ana görsel/video'su yap → iş akışı tamamlanır + video/AI kaynağı olur.
    if (type === 'gorsel') {
      await patchContent(slug, { gorsel: { url: servedUrl, localPath: servedUrl, imageSource: 'manuel-yükleme', manual: true, at } });
    } else {
      await patchContent(slug, { video: { url: servedUrl, localPath: servedUrl, type: 'manuel', lang, manual: true, at } });
    }

    return NextResponse.json({ ok: true, entry, url: servedUrl, type });
  } catch (err) {
    console.error('[library/upload]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
