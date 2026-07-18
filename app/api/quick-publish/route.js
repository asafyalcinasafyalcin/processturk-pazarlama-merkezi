import { NextResponse } from 'next/server';
import { publishMetaAuto } from '@/lib/meta-publish';
import { audit } from '@/lib/audit';

// Sosyal Yayın Servisi (4173) basic-auth arkasındadır — /api/health dışındaki her uç
// kimlik ister. Kimlik verilmezse yayın çağrıları 401 alır ve SESSİZCE yayınlanmaz.
function sosyalYayinBasligi() {
  const k = process.env.ICERIK_AJANI_KULLANICI;
  const p = process.env.ICERIK_AJANI_PAROLA;
  if (!k || !p) return {};
  return { Authorization: 'Basic ' + Buffer.from(`${k}:${p}`).toString('base64') };
}

export const runtime = 'nodejs';
export const maxDuration = 120;

// ── ONAYSIZ HIZLI YAYIN (GÜVENE ALINDI — Faz 0A) ──
// Takvim/approval gate YOK. Kullanıcı "Acil Paylaş" butonuna tıkladığında tetiklenir.
// Bu uç GEÇİCİ bir token kilidiyle (QUICK_PUBLISH_TOKEN) + zorunlu confirm ile korunur;
// gerçek RBAC (Owner/Admin/Emergency Publisher) Faz 2'de bu guard'ı değiştirecek.
// Her çıkış (red/başarı/hata/assisted) data/audit-log.jsonl'e kaydedilir.
// Sadece meta (instagram/facebook) ve icerik-ajani (linkedin/x) desteklenir.
// tiktok/youtube → assisted paket döner (manuel kopyala-yapıştır).

const META_PLATFORMS = ['instagram', 'facebook'];
const ICERIK_PLATFORMS = ['linkedin', 'x'];
const ASSISTED_PLATFORMS = ['tiktok', 'youtube'];
const SUPPORTED = [...META_PLATFORMS, ...ICERIK_PLATFORMS, ...ASSISTED_PLATFORMS];
// Metin zorunlu platformlar (caption boş olamaz).
const TEXT_REQUIRED = [...ICERIK_PLATFORMS];

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for') || null;
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const { platform, imageUrl, videoUrl, caption, hashtags = [], actor, confirm, publishAs } = body;

  // Ortak audit tabanı (her çıkış öncesi audit(...) çağrılır).
  const base = {
    actor: actor || 'unknown',
    ip,
    action: 'quick-publish',
    platform: platform || null,
    captionPreview: String(caption || '').slice(0, 120),
  };

  try {
    // 1) GEÇİCİ GUARD (fail-closed) — token yoksa veya yanlışsa yayın YOK.
    const ADMIN = process.env.QUICK_PUBLISH_TOKEN;
    const sent = request.headers.get('x-admin-token');
    if (!ADMIN || sent !== ADMIN) {
      await audit({ ...base, ok: false, error: 'yetkisiz (403)' });
      return NextResponse.json({ ok: false, error: 'Yetkisiz (acil yayın kilitli).' }, { status: 403 });
    }

    // 2) ZORUNLU SON ONAY.
    if (confirm !== true) {
      await audit({ ...base, ok: false, error: 'confirm eksik (409)' });
      return NextResponse.json({ ok: false, error: 'confirm:true gerekli (acil yayın teyidi).' }, { status: 409 });
    }

    // 3) BASİT VALİDASYON.
    if (!platform) {
      await audit({ ...base, ok: false, error: 'platform eksik (400)' });
      return NextResponse.json({ ok: false, error: 'platform zorunlu' }, { status: 400 });
    }
    if (!SUPPORTED.includes(platform)) {
      await audit({ ...base, ok: false, error: 'desteklenmeyen platform (400)' });
      return NextResponse.json({ ok: false, error: `Desteklenmeyen platform: ${platform}` }, { status: 400 });
    }
    if (TEXT_REQUIRED.includes(platform) && !String(caption || '').trim()) {
      await audit({ ...base, ok: false, error: 'caption boş (400)' });
      return NextResponse.json({ ok: false, error: 'caption zorunlu (metin platformu)' }, { status: 400 });
    }

    const fullCaption = hashtags.length > 0
      ? `${caption || ''}\n\n${hashtags.join(' ')}`
      : (caption || '');

    // ── Meta (Instagram / Facebook) ──
    if (META_PLATFORMS.includes(platform)) {
      if (!imageUrl && !videoUrl) {
        await audit({ ...base, ok: false, error: 'medya eksik (400)' });
        return NextResponse.json({ ok: false, error: 'imageUrl veya videoUrl zorunlu' }, { status: 400 });
      }
      try {
        const result = await publishMetaAuto(platform, { imageUrl, videoUrl, caption: fullCaption });
        await audit({ ...base, ok: true, providerPostId: result?.id || result?.postId || result?.post_id || null });
        return NextResponse.json({ ok: true, method: 'meta-api', platform, result });
      } catch (e) {
        await audit({ ...base, ok: false, error: `meta: ${e.message}` });
        return NextResponse.json({ ok: false, error: `Meta yayını başarısız: ${e.message}` }, { status: 502 });
      }
    }

    // ── Sosyal Yayın Servisi köprüsü (LinkedIn / X) ──
    if (ICERIK_PLATFORMS.includes(platform)) {
      const apiBase = process.env.ICERIK_AJANI_URL || 'http://127.0.0.1:4173';
      const endpoint = `${apiBase}/api/publish/${platform}`;
      const liAs = publishAs === 'organization' || publishAs === 'person' ? publishAs : null;
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...sosyalYayinBasligi() },
          body: JSON.stringify({
            text: fullCaption,
            imageUrl: imageUrl || undefined,
            videoUrl: videoUrl || undefined,
            // LinkedIn kurumsal sayfa / kişisel profil seçimi. Geçilmezse servis
            // LINKEDIN_PUBLISH_AS varsayılanına düşer (yanlış hesap riski).
            ...(platform === 'linkedin' && liAs ? { publishAs: liAs } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok || data?.ok === false) {
          await audit({ ...base, ok: false, error: data?.error || 'yayın başarısız' });
          return NextResponse.json({ ok: false, error: data?.error || 'Yayın başarısız' }, { status: 502 });
        }
        await audit({ ...base, ok: true, providerPostId: data?.id || data?.postId || null });
        return NextResponse.json({ ok: true, method: 'icerik-ajani', platform, result: data });
      } catch (e) {
        await audit({ ...base, ok: false, error: `icerik-ajani: ${e.message}` });
        return NextResponse.json({
          ok: false,
          error: `İçerik ajanına ulaşılamadı (${apiBase}). Açık mı? ${e.message}`,
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
      await audit({ ...base, ok: true, method: 'assisted', published: false });
      return NextResponse.json({ ok: true, method: 'assisted', published: false, package: pkg });
    }

    // Buraya normalde ulaşılmaz (SUPPORTED kontrolü yukarıda).
    await audit({ ...base, ok: false, error: 'desteklenmeyen platform (400)' });
    return NextResponse.json({ ok: false, error: `Desteklenmeyen platform: ${platform}` }, { status: 400 });
  } catch (err) {
    console.error('[quick-publish]', err);
    await audit({ ...base, ok: false, error: err.message });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
