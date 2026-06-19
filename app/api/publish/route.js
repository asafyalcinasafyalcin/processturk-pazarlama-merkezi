import { NextResponse } from 'next/server';
import { getItem, updateItem, META_PUBLISH, ICERIK_PUBLISH } from '@/lib/calendar';
import { publishMeta } from '@/lib/meta-publish';

export const runtime = 'nodejs';
export const maxDuration = 300;

// ── ONAY KAPISI ──
// Yayın yalnızca status === 'approved' öğeler için yapılır. Onaysız hiçbir şey yayınlanmaz
// (CLAUDE.md "Toplu Gönderim Onayı" kuralı). LinkedIn/X gerçek API'ye gider;
// Instagram/TikTok/YouTube/Facebook için API onayı gelene kadar "assisted paket" döner.
export async function POST(request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ ok: false, error: 'id zorunlu' }, { status: 400 });

    const item = await getItem(id);
    if (!item) return NextResponse.json({ ok: false, error: 'Öğe bulunamadı' }, { status: 404 });

    if (item.status !== 'approved') {
      return NextResponse.json({ ok: false, error: 'Önce onaylayın. Onaysız gönderim yapılamaz.' }, { status: 409 });
    }

    // Gerçek yayın: Instagram / Facebook (Meta Graph API)
    if (META_PUBLISH.includes(item.platform)) {
      try {
        const result = await publishMeta(item.platform, { videoUrl: item.videoUrl, caption: item.caption });
        const updated = await updateItem(id, { status: 'published', publishedAt: new Date().toISOString(), result: { method: 'meta-api', ...result } });
        return NextResponse.json({ ok: true, method: 'meta-api', item: updated });
      } catch (e) {
        return NextResponse.json({ ok: false, error: `Meta yayını başarısız: ${e.message}` }, { status: 502 });
      }
    }

    // Gerçek yayın: LinkedIn / X (icerik-ajani köprüsü)
    if (ICERIK_PUBLISH.includes(item.platform)) {
      const base = process.env.ICERIK_AJANI_URL || 'http://127.0.0.1:4173';
      const endpoint = `${base}/api/publish/${item.platform}`;
      let res, data;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: item.caption, imageUrl: item.videoUrl || undefined }),
        });
        data = await res.json();
      } catch (e) {
        return NextResponse.json({ ok: false, error: `İçerik ajanına ulaşılamadı (${base}). Açık mı? ${e.message}` }, { status: 502 });
      }
      if (!res.ok || data?.ok === false) {
        return NextResponse.json({ ok: false, error: data?.error || 'Yayın başarısız' }, { status: 502 });
      }
      const updated = await updateItem(id, { status: 'published', publishedAt: new Date().toISOString(), result: { method: 'api', platform: item.platform, raw: data } });
      return NextResponse.json({ ok: true, method: 'api', item: updated });
    }

    // Assisted yayın: video reklam platformları (API onayı bekliyor)
    const hashtags = '#ProcessTürk #üretim #makine #foodprocessing';
    const pkg = {
      platform: item.platform,
      caption: item.caption,
      hashtags,
      videoUrl: item.videoUrl,
      instructions: `${item.platform} uygulamasında: videoyu indir, açıklamayı yapıştır, WhatsApp linkini bio/CTA'ya ekle.`,
    };
    const updated = await updateItem(id, {
      status: 'published',
      publishedAt: new Date().toISOString(),
      result: { method: 'assisted', platform: item.platform, package: pkg },
    });
    return NextResponse.json({ ok: true, method: 'assisted', package: pkg, item: updated });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
