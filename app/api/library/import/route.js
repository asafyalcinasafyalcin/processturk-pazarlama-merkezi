// Hazır içeriği panele getir: Higgsfield Job ID veya herkese açık URL.
// Medya çekilir → data/uploads'a indirilir → kütüphaneye düşer → Takvimden paylaşılabilir.
// (Dosya yükleme yolu için: /api/library/upload)
// POST { slug, source:'hf-id'|'url', value, lang?, caption? }
import { NextResponse } from 'next/server';
import { addToLibrary } from '@/lib/library';
import { saveFromUrl } from '@/lib/media-store';
import { getJobMedia } from '@/lib/hf-jobs';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MEDIA_URL_RE = /^https?:\/\/.+\.(png|jpe?g|webp|mp4|mov|webm)(\?.*)?$/i;
const VIDEO_EXT_RE = /\.(mp4|mov|webm)(\?.*)?$/i;

export async function POST(request) {
  try {
    const { slug, source, value, lang = 'tr', caption = '' } = await request.json();
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    if (!source || !value) return NextResponse.json({ ok: false, error: 'source ve value zorunlu' }, { status: 400 });

    let mediaUrl, kind, hfJobId = null, model = null;

    if (source === 'hf-id') {
      const r = await getJobMedia(value);
      mediaUrl = r.url; kind = r.kind; hfJobId = String(value).trim(); model = r.model;
    } else if (source === 'url') {
      const url = String(value).trim();
      if (!MEDIA_URL_RE.test(url)) {
        return NextResponse.json({ ok: false, error: 'Geçerli bir görsel/video URL girin (png/jpg/webp/mp4/mov/webm).' }, { status: 400 });
      }
      mediaUrl = url; kind = VIDEO_EXT_RE.test(url) ? 'video' : 'image';
    } else {
      return NextResponse.json({ ok: false, error: `Bilinmeyen kaynak: ${source}` }, { status: 400 });
    }

    const type = kind === 'video' ? 'video' : 'gorsel';
    const { servedUrl } = await saveFromUrl(mediaUrl, { slug, type });

    const entry = addToLibrary(slug, type, {
      url: servedUrl, localPath: servedUrl, lang, caption: caption || null,
      manual: true, imageSource: source === 'hf-id' ? 'hf-id' : 'url',
      hfJobId, model, at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, entry, url: servedUrl, type });
  } catch (err) {
    console.error('[library/import]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
