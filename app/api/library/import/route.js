// Hazır içeriği panele getir: Higgsfield Job ID veya herkese açık URL.
// Medya çekilir → data/uploads'a indirilir → kütüphaneye düşer → ÜRÜNÜN ana görsel/video'su olur
// (content.gorsel/content.video) → Takvimden paylaşılabilir + video/AI kaynağı olur.
// (Dosya yükleme yolu için: /api/library/upload)
// POST { slug, source:'hf-id'|'url', value, lang?, caption? }
import { NextResponse } from 'next/server';
import fs from 'node:fs';
import { addToLibrary } from '@/lib/library';
import { saveFromUrl, kindFromContentType } from '@/lib/media-store';
import { patchContent } from '@/lib/content';
import { getJobMedia } from '@/lib/hf-jobs';

export const runtime = 'nodejs';
export const maxDuration = 120;

const VIDEO_EXT_RE = /\.(mp4|mov|webm)(\?.*)?$/i;
const IMG_EXT_RE = /\.(png|jpe?g|webp)(\?.*)?$/i;

export async function POST(request) {
  try {
    const { slug, source, value, lang = 'tr', caption = '' } = await request.json();
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    if (!source || !value) return NextResponse.json({ ok: false, error: 'source ve value zorunlu' }, { status: 400 });

    let servedUrl, kind, hfJobId = null, model = null, imageSource;

    if (source === 'hf-id') {
      const r = await getJobMedia(value);
      const saved = await saveFromUrl(r.url, { slug, type: r.kind === 'video' ? 'video' : 'gorsel' });
      servedUrl = saved.servedUrl; kind = r.kind; hfJobId = String(value).trim(); model = r.model;
      imageSource = 'hf-id';
    } else if (source === 'url') {
      const url = String(value).trim();
      if (!/^https?:\/\//i.test(url)) {
        return NextResponse.json({ ok: false, error: 'http(s):// ile başlayan bir URL girin.' }, { status: 400 });
      }
      // Tip baştan belli değil — indir + content-type'tan karar ver (uzantısız/imzalı CDN URL'leri için).
      // content-type belirsizse uzantıya bak; o da yoksa medya değildir → reddet (HTML vb. kabul etme).
      const saved = await saveFromUrl(url, { slug, type: 'gorsel' });
      kind = kindFromContentType(saved.contentType);
      if (!kind) {
        if (VIDEO_EXT_RE.test(url)) kind = 'video';
        else if (IMG_EXT_RE.test(url)) kind = 'image';
      }
      if (kind !== 'image' && kind !== 'video') {
        try { fs.unlinkSync(saved.absPath); } catch { /* yoksay */ }
        return NextResponse.json({ ok: false, error: `URL bir görsel/video değil (content-type: ${saved.contentType || 'bilinmiyor'}).` }, { status: 400 });
      }
      servedUrl = saved.servedUrl; imageSource = 'url';
    } else {
      return NextResponse.json({ ok: false, error: `Bilinmeyen kaynak: ${source}` }, { status: 400 });
    }

    const type = kind === 'video' ? 'video' : 'gorsel';
    const at = new Date().toISOString();
    const entry = addToLibrary(slug, type, {
      url: servedUrl, localPath: servedUrl, lang, caption: caption || null,
      manual: true, imageSource, hfJobId, model, at,
    });

    // Eklenen medyayı ürünün ana görsel/video durumuna yaz → iş akışı tamamlanır,
    // önizleme güncellenir, video/AI bunu kaynak olarak kullanır.
    if (type === 'gorsel') {
      await patchContent(slug, { gorsel: { url: servedUrl, localPath: servedUrl, imageSource, manual: true, hfJobId, at } });
    } else {
      await patchContent(slug, { video: { url: servedUrl, localPath: servedUrl, type: 'manuel', lang, manual: true, hfJobId, at } });
    }

    return NextResponse.json({ ok: true, entry, url: servedUrl, type });
  } catch (err) {
    console.error('[library/import]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
