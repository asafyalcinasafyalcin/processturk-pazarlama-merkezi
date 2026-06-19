import { NextResponse } from 'next/server';
import path from 'node:path';
import { findProduct } from '@/lib/products';
import { getContent } from '@/lib/content';
import { WORKSPACE_ROOT } from '@/lib/paths';
import { BRAND } from '@/lib/brand';
import { planAdScript } from '@/lib/scene-plan';
import { buildSrt } from '@/lib/srt';
import { normalizeForTTS } from '@/lib/tts-normalize';
import { readSettings } from '@/lib/settings';
import { videoImageInput } from '@/lib/product-image';
import { genVideo, genVoice, genMusic } from '@/lib/providers/gen';
import { renderAdVideo } from '@/lib/render';
import {
  STAGES, readPipeline, setStageDraft, editStageDraft, approveStage,
  upstreamHash, computeStatus,
} from '@/lib/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 800;
const LOGO = path.join(WORKSPACE_ROOT, 'Meta_Reklam_Sistemi', 'assets', 'processturk-logo-white.png');

function cap1(s, lang) { return s ? s.charAt(0).toLocaleUpperCase(lang === 'tr' ? 'tr' : 'en') + s.slice(1) : s; }

export async function POST(request, { params }) {
  try {
    const { stage } = await params;
    if (!STAGES.includes(stage)) return NextResponse.json({ ok: false, error: 'geçersiz aşama' }, { status: 400 });
    const body = await request.json();
    const { slug, lang = 'tr', action = 'generate', edit } = body;
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });

    // ── ONAYLA ──
    if (action === 'approve') {
      const pipe = await approveStage(slug, lang, stage);
      return NextResponse.json({ ok: true, pipeline: pipe, status: computeStatus(pipe) });
    }

    // ── DÜZENLE (elle) ──
    if (action === 'edit') {
      let data = edit || {};
      if (stage === 'text') {
        const pipe = await readPipeline(slug, lang);
        const cur = pipe.text.data || {};
        const hook = data.hook ?? cur.hook;
        const benefitB = data.benefitB ?? cur.benefitB;
        const scenes = (cur.scenes || []).map((s) => {
          if (s.type === 'hook') return { ...s, caption: hook };
          if (s.type === 'benefit') return { ...s, captionLines: [cur.capacity ? cap1(cur.capacity, lang) : s.captionLines?.[0], benefitB] };
          return s;
        });
        data = { ...data, scenes };
      }
      const pipe = await editStageDraft(slug, lang, stage, data);
      return NextResponse.json({ ok: true, pipeline: pipe, status: computeStatus(pipe) });
    }

    // ── ÜRET ──
    const product = await findProduct(slug);
    if (!product) return NextResponse.json({ ok: false, error: 'Ürün bulunamadı' }, { status: 404 });
    const pipe = await readPipeline(slug, lang);

    // üst aşama onaylı mı?
    const up = upstreamHash(pipe, stage);
    if (up === null) return NextResponse.json({ ok: false, error: 'Önce üst aşamayı (metin) onaylayın.' }, { status: 409 });

    if (stage === 'text') {
      const existing = await getContent(slug);
      const highlights = product.marketing?.highlights?.length ? product.marketing.highlights : (existing?.copy?.highlights || []);
      const plan = await planAdScript({ product, lang, highlights });
      const data = { hook: plan.hook, benefitB: plan.benefitB, voiceover: plan.voiceover, scenes: plan.scenes, capacity: plan.capacity, specLines: plan.specLines, trustLines: plan.trustLines, totalSec: plan.totalSec };
      const out = await setStageDraft(slug, lang, 'text', data);
      return NextResponse.json({ ok: true, pipeline: out, status: computeStatus(out) });
    }

    if (stage === 'voice') {
      const settings = await readSettings();
      const spoken = normalizeForTTS(pipe.text.data.voiceover, lang, settings.pronounce);
      const v = await genVoice({ text: spoken, voice: body.voice || settings.brandVoice, voiceId: body.voice || settings.brandVoice, preset: body.preset || settings.brandPreset });
      const out = await setStageDraft(slug, lang, 'voice', { url: v.url, voice: v.voice, preset: v.preset, spoken });
      return NextResponse.json({ ok: true, pipeline: out, status: computeStatus(out) });
    }

    if (stage === 'subtitle') {
      const { srt, cues, totalSec } = buildSrt(pipe.text.data.scenes);
      const out = await setStageDraft(slug, lang, 'subtitle', { srt, cues, totalSec });
      // deterministik → otomatik onayla
      const approved = await approveStage(slug, lang, 'subtitle');
      return NextResponse.json({ ok: true, pipeline: approved, status: computeStatus(approved) });
    }

    if (stage === 'video') {
      const scenes = pipe.text.data.scenes;
      const img = await videoImageInput(product);
      const motion = 'the real machine actively filling product, product flowing into packages, smooth subtle camera push-in then slow pan, medium/wide shot, factory background, premium commercial, realistic';
      const negative = 'text, letters, numbers, logo, brand name, control panel, screen, monitor, display, UI, buttons, watermark, subtitles, distorted hands, distorted faces, deformed';
      const clip = await genVideo({ model: body.videoModel, prompt: motion, negative_prompt: negative, imagePath: img.imagePath, image_url: img.url, aspect_ratio: '9:16', resolution: '720p', duration: 10 });
      if (!clip.url) throw new Error('Ürün klibi üretilemedi.');

      let seg = 0;
      const withClips = scenes.map((s) => {
        if (s.type === 'hook' || s.type === 'benefit') { const o = { ...s, clipUrl: clip.url, segStart: seg }; seg += s.durationSec; return o; }
        return s;
      });

      // onaylı seslendirme varsa kullan (yeniden üretme — tekrar ücret yok)
      const voiceUrl = pipe.voice.status === 'approved' ? pipe.voice.data?.url : null;
      let musicUrl = null;
      if (body.music !== false) { try { musicUrl = (await genMusic({ prompt: 'calm corporate industrial background, subtle, motivating, no vocals', seconds: pipe.text.data.totalSec || 20 })).url; } catch { /* skip */ } }

      const rendered = await renderAdVideo({ slug, lang, scenes: withClips, voiceUrl, musicUrl, whatsapp: BRAND.whatsapp, web: BRAND.web, logoPath: LOGO });
      const out = await setStageDraft(slug, lang, 'video', { url: rendered.publicPath, durationSec: rendered.durationSec, imageSource: img.source, voice: Boolean(voiceUrl), music: Boolean(musicUrl) });
      return NextResponse.json({ ok: true, pipeline: out, status: computeStatus(out) });
    }

    return NextResponse.json({ ok: false, error: 'bilinmeyen aşama' }, { status: 400 });
  } catch (err) {
    const detail = err?.body?.detail || err?.body?.detail?.[0]?.msg;
    return NextResponse.json({ ok: false, error: err.message || 'hata', detail: typeof detail === 'string' ? detail : null }, { status: 500 });
  }
}
