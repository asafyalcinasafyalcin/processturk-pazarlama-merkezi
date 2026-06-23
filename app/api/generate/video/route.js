import { NextResponse } from 'next/server';
import path from 'node:path';
import { findProduct } from '@/lib/products';
import { metaReklamRoot } from '@/lib/paths';
import { downloadAndSave } from '@/lib/download-asset';
import { readBrief } from '@/lib/brief';
import { planAdScript } from '@/lib/scene-plan';
import { videoImageInput } from '@/lib/product-image';
import { genVideo, genVoice, genMusic } from '@/lib/providers/gen';
import { renderAdVideo } from '@/lib/render';
import { saveRawClip, brandOverlay } from '@/lib/raw-clip';
import { patchContent, getContent } from '@/lib/content';
import { BRAND } from '@/lib/brand';
import { normalizeForTTS } from '@/lib/tts-normalize';
import { readSettings } from '@/lib/settings';

export const runtime = 'nodejs';
export const maxDuration = 800;

const LOGO = path.join(metaReklamRoot(), 'assets', 'processturk-logo-white.png');

// TAM PIPELINE: senaryo (fiyatsız) → gerçek ürün görseli → 10sn i2v klip → seslendirme
// + müzik → ffmpeg render (logo intro/outro + spec kartı + altyazı) → 9:16 mp4.
export async function POST(request) {
  try {
    const body = await request.json();
    const { slug } = body;
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    const product = await findProduct(slug);
    if (!product) return NextResponse.json({ ok: false, error: 'Ürün bulunamadı' }, { status: 404 });

    const lang = body.lang || (product.marketing?.languages || ['tr'])[0];
    const wantVoice = body.voice !== false;
    const wantMusic = body.music !== false;
    const existing = await getContent(slug);
    // Brief'ten highlights — varsa brief öncelikli
    const brief = readBrief(slug);
    const highlights = brief?.highlights?.length
      ? brief.highlights
      : (product.marketing?.highlights?.length ? product.marketing.highlights : (existing?.copy?.highlights || []));
    const videoModel = body.videoModel || 'seedance-2-fast';
    const aspectRatio = body.aspect_ratio || '9:16';
    const duration = Math.min(Math.max(body.duration || 15, 10), 20); // 10-20sn arası

    // Slug cache: aynı slug+lang+model için ≤7 günlük video varsa tekrar üretme.
    // force:true ile aşılır.
    if (!body.force) {
      const cv = existing?.video;
      if (cv?.url && cv.lang === lang && cv.model === videoModel) {
        const ageDays = (Date.now() - new Date(cv.at).getTime()) / 86400000;
        if (ageDays < 7) {
          return NextResponse.json({ ok: true, video: cv, plan: existing?.scriptPlan, fromCache: true });
        }
      }
    }

    // 1) senaryo (fiyatsız, harekete geçirici)
    const plan = await planAdScript({ product, lang, highlights });

    // 2) gerçek ürün görseli — 4-adımlı öncelik (product-image.js)
    const img = await videoImageInput(product);
    if (!img) {
      return NextResponse.json({
        ok: false,
        error: 'Kaynak görsel bulunamadı',
        action: 'upload_image',
        message: 'Önce ürün fotoğrafı yükleyin (Görsel sekmesi) veya Görsel Üret adımını çalıştırın.',
      }, { status: 422 });
    }

    // 3) tek 10sn i2v klip (gerçek ürün DOLUM YAPARKEN); kanca + fayda sahnelerine bölünür
    const motion = 'the real machine actively filling product, product flowing into packages, smooth subtle camera push-in then slow pan, medium/wide shot, factory background, premium commercial, realistic';
    const negative = 'text, letters, numbers, logo, brand name, control panel, screen, monitor, display, UI, buttons, watermark, subtitles, distorted hands, distorted faces, deformed';
    const clip = await genVideo({ model: videoModel, prompt: motion, negative_prompt: negative, imagePath: img.imagePath, image_url: img.url, aspect_ratio: aspectRatio, resolution: '720p', duration, force: body.force });
    if (!clip.url) throw new Error('Ürün klibi üretilemedi.');

    // mode:'raw' → markasız temiz klibi kaydet; brandOverlay ile reklam marka katmanını göm.
    // Panelin tam anlatılı render'ından (altyazı/kart/seslendirme) ayrı, "5sn tek-kare" reklam yolu.
    if (body.mode === 'raw') {
      const raw = await saveRawClip({ url: clip.url, slug, lang });
      let branded = null;
      if (body.brandOverlay !== false) {
        try { branded = await brandOverlay({ rawFile: raw.file, slug, lang }); }
        catch (e) { console.warn('Marka katmanı atlandı:', e.message); }
      }
      const chosen = branded || raw;
      const video = {
        url: chosen.publicPath, type: branded ? 'raw-branded' : 'raw', lang,
        rawUrl: raw.publicPath, imageSource: img.source, voice: false, music: false,
        voiceUrl: null, musicUrl: null,
        model: videoModel, at: new Date().toISOString(),
      };
      await patchContent(slug, { video, scriptPlan: plan });
      return NextResponse.json({ ok: true, video, plan, imageSource: img.source, branded: Boolean(branded) });
    }

    // kanca(0-3sn) + fayda(3-9sn) sahnelerine tek klibi segment olarak ata
    let seg = 0;
    const scenes = plan.scenes.map((s) => {
      if (s.type === 'hook' || s.type === 'benefit') { const out = { ...s, clipUrl: clip.url, segStart: seg }; seg += s.durationSec; return out; }
      return s;
    });

    // 4) seslendirme + müzik (opsiyonel)
    // Mevcut ses/müzik URL'leri content.json'dan alınır; yoksa üretilir.
    // Aynı voiceover metni + aynı müzik prompt → tekrar üretilmez (gen.js prompt-hash cache).
    const settings = await readSettings();
    let voiceUrl = existing?.video?.voiceUrl || null;
    let musicUrl = existing?.video?.musicUrl || null;
    if (wantVoice && plan.voiceover && !voiceUrl) {
      try {
        const spoken = normalizeForTTS(plan.voiceover, lang, settings.pronounce);
        // lang geçilir → HF per-language voice map kullanılır
        voiceUrl = (await genVoice({ text: spoken, lang, voice: body.voiceName || settings.brandVoice, voiceId: body.voiceName || settings.brandVoice, preset: body.preset || settings.brandPreset, voiceStyle: body.voiceStyle || 'satis', force: body.force })).url;
      } catch (e) { console.warn('TTS atlandı:', e.message); }
    }
    if (wantMusic && !musicUrl) {
      try { musicUrl = (await genMusic({ prompt: 'calm corporate industrial background, subtle, motivating, no vocals', seconds: plan.totalSec, force: body.force })).url; }
      catch (e) { console.warn('Müzik atlandı:', e.message); }
    }

    // 5) render
    const rendered = await renderAdVideo({
      slug, lang, scenes, voiceUrl, musicUrl,
      whatsapp: BRAND.whatsapp, web: BRAND.web, logoPath: LOGO,
    });

    // Render edilmiş videoyu yerel kopyala
    const { localPath: videoLocalPath } = await downloadAndSave(rendered.publicPath, slug, 'video').catch(() => ({ localPath: null }));

    const video = {
      url: rendered.publicPath,
      localPath: videoLocalPath || null,
      type: 'rendered', lang, aspectRatio, platform: body.platform || null,
      durationSec: rendered.durationSec, imageSource: img.source,
      voice: Boolean(voiceUrl), music: Boolean(musicUrl), model: videoModel,
      voiceUrl, musicUrl,
      at: new Date().toISOString(),
    };
    await patchContent(slug, { video, scriptPlan: plan });
    return NextResponse.json({ ok: true, video, plan, imageSource: img.source });
  } catch (err) {
    const detail = err?.body?.detail?.[0];
    return NextResponse.json({ ok: false, error: err.message || 'Üretim başarısız', detail: detail?.msg || null }, { status: 500 });
  }
}
