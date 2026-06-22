import { NextResponse } from 'next/server';
import { getItem, updateItem, META_PUBLISH, ICERIK_PUBLISH } from '@/lib/calendar';
import { publishMetaAuto } from '@/lib/meta-publish';
import { publishTikTok, publishYouTube, tiktokConfigured, youtubeConfigured } from '@/lib/tiktok-youtube-publish';

// Relative URL'leri absolute'a çevir (Meta Graph API public URL gerektirir)
function resolveMediaUrl(url) {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = process.env.PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  return base ? `${base.replace(/\/$/, '')}${url}` : url;
}

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
      const imageUrl = resolveMediaUrl(item.imageUrl);
      const videoUrl = resolveMediaUrl(item.videoUrl);
      try {
        const result = await publishMetaAuto(item.platform, { imageUrl, videoUrl, caption: item.caption });
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
          body: JSON.stringify({ text: item.caption, imageUrl: resolveMediaUrl(item.imageUrl) || undefined }),
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

    // Gerçek yayın: TikTok (credentials varsa)
    if (item.platform === 'tiktok' && tiktokConfigured()) {
      const videoUrl = resolveMediaUrl(item.videoUrl);
      try {
        const result = await publishTikTok({ videoUrl, caption: item.caption });
        const updated = await updateItem(id, { status: 'published', publishedAt: new Date().toISOString(), result: { method: 'tiktok-api', ...result } });
        return NextResponse.json({ ok: true, method: 'tiktok-api', item: updated });
      } catch (e) {
        return NextResponse.json({ ok: false, error: `TikTok yayını başarısız: ${e.message}` }, { status: 502 });
      }
    }

    // Gerçek yayın: YouTube (credentials varsa)
    if (item.platform === 'youtube' && youtubeConfigured()) {
      const videoUrl = resolveMediaUrl(item.videoUrl);
      const title = item.caption?.split('\n')[0]?.slice(0, 100) || 'ProcessTürk';
      try {
        const result = await publishYouTube({ videoUrl, caption: item.caption, title });
        const updated = await updateItem(id, { status: 'published', publishedAt: new Date().toISOString(), result: { method: 'youtube-api', ...result } });
        return NextResponse.json({ ok: true, method: 'youtube-api', item: updated });
      } catch (e) {
        return NextResponse.json({ ok: false, error: `YouTube yayını başarısız: ${e.message}` }, { status: 502 });
      }
    }

    // Assisted yayın: TikTok/YouTube credentials yoksa veya başka platform
    const PLATFORM_TAGS = {
      tiktok: '#ProcessTurk #FoodMachinery #Manufacturing #MadeInTurkey #DolamMakinesi',
      youtube: '#ProcessTürk #Üretim #FoodProcessing #MadeInTurkey',
    };
    const hashtags = PLATFORM_TAGS[item.platform] || '#ProcessTürk #üretim #makine #foodprocessing';

    const PLATFORM_INST = {
      tiktok: 'TikTok uygulamasında: videoyu indir → "+" → videoyu seç → açıklamayı yapıştır → Yayınla.',
      youtube: 'YouTube Studio\'da (studio.youtube.com): İçerik Yükle → videoyu seç → başlık/açıklamayı yapıştır → Herkese Açık → Yayınla.',
    };
    const instructions = PLATFORM_INST[item.platform] || `${item.platform} uygulamasında: videoyu indir, açıklamayı yapıştır.`;

    const videoUrl = resolveMediaUrl(item.videoUrl);
    const title = item.platform === 'youtube' ? (item.caption?.split('\n')[0]?.slice(0, 100) || 'ProcessTürk') : undefined;

    const pkg = {
      platform: item.platform,
      caption: item.caption,
      hashtags,
      videoUrl,
      ...(title ? { title } : {}),
      instructions,
      credentialNote: item.platform === 'tiktok'
        ? 'Otomatik için: TIKTOK_CLIENT_KEY + TIKTOK_ACCESS_TOKEN + TIKTOK_OPEN_ID ekle.'
        : item.platform === 'youtube'
        ? 'Otomatik için: GOOGLE_CLIENT_ID + GOOGLE_REFRESH_TOKEN + YOUTUBE_CHANNEL_ID ekle.'
        : undefined,
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
