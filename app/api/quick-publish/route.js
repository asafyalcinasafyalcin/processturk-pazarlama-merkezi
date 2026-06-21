import { NextResponse } from 'next/server';
import { publishMetaAuto } from '@/lib/meta-publish';

export const runtime = 'nodejs';
export const maxDuration = 120;

// ── ONAYSIZ HIZLI YAYIN ──
// Takvim/approval gate YOK. Kullanıcı "Acil Paylaş" butonuna tıkladığında tetiklenir.
// Sadece meta (instagram/facebook) ve icerik-ajani (linkedin/x) desteklenir.
// tiktok/youtube → assisted paket döner (manuel kopyala-yapıştır).

const META_PLATFORMS = ['instagram', 'facebook'];
const ICERIK_PLATFORMS = ['linkedin', 'x'];
const ASSISTED_PLATFORMS = ['tiktok', 'youtube'];

export async function POST(request) {
  try {
    const body = await request.json();
    const { platform, imageUrl, videoUrl, caption, hashtags = [] } = body;

    if (!platform) return NextResponse.json({ ok: false, error: 'platform zorunlu' }, { status: 400 });

    const fullCaption = hashtags.length > 0
      ? `${caption || ''}\n\n${hashtags.join(' ')}`
      : (caption || '');

    // ── Meta (Instagram / Facebook) ──
    if (META_PLATFORMS.includes(platform)) {
      if (!imageUrl && !videoUrl) {
        return NextResponse.json({ ok: false, error: 'imageUrl veya videoUrl zorunlu' }, { status: 400 });
      }
      try {
        const result = await publishMetaAuto(platform, { imageUrl, videoUrl, caption: fullCaption });
        return NextResponse.json({ ok: true, method: 'meta-api', platform, result });
      } catch (e) {
        return NextResponse.json({ ok: false, error: `Meta yayını başarısız: ${e.message}` }, { status: 502 });
      }
    }

    // ── icerik-ajani köprüsü (LinkedIn / X) ──
    if (ICERIK_PLATFORMS.includes(platform)) {
      const base = process.env.ICERIK_AJANI_URL || 'http://127.0.0.1:4173';
      const endpoint = `${base}/api/publish/${platform}`;
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: fullCaption, imageUrl: imageUrl || undefined, videoUrl: videoUrl || undefined }),
        });
        const data = await res.json();
        if (!res.ok || data?.ok === false) {
          return NextResponse.json({ ok: false, error: data?.error || 'Yayın başarısız' }, { status: 502 });
        }
        return NextResponse.json({ ok: true, method: 'icerik-ajani', platform, result: data });
      } catch (e) {
        return NextResponse.json({
          ok: false,
          error: `İçerik ajanına ulaşılamadı (${base}). Açık mı? ${e.message}`,
        }, { status: 502 });
      }
    }

    // ── Assisted mod (TikTok / YouTube) ──
    if (ASSISTED_PLATFORMS.includes(platform)) {
      const pkg = {
        platform,
        caption: fullCaption,
        imageUrl: imageUrl || null,
        videoUrl: videoUrl || null,
        instructions: platform === 'tiktok'
          ? 'TikTok uygulamasında: videoyu/görseli indir → yeni gönderi → açıklamayı yapıştır → yayınla.'
          : 'YouTube Studio\'da: videoyu yükle → açıklamayı yapıştır → yayınla.',
      };
      return NextResponse.json({ ok: true, method: 'assisted', package: pkg });
    }

    return NextResponse.json({ ok: false, error: `Desteklenmeyen platform: ${platform}` }, { status: 400 });
  } catch (err) {
    console.error('[quick-publish]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
