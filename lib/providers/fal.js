// Self-contained fal.ai provider. Processturk_Video_Maker/lib/providers/fal.js'in
// kanıtlanmış kopyası + ürün reklamı eklentileri (upload, TTS, müzik).
import { fal } from '@fal-ai/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const key = process.env.FAL_KEY;
  if (!key) {
    throw new Error('FAL_KEY tanımlı değil. .env.local dosyasına ekleyin (Meta_Reklam_Sistemi/.env.local ile aynı anahtar).');
  }
  fal.config({ credentials: key });
  configured = true;
}

// ── Görsel modelleri (video için ilk-kare olarak da kullanılır) ──
export const FAL_IMAGE_MODELS = [
  { id: 'flux-schnell', label: 'Flux Schnell (hızlı/ucuz)', endpoint: 'fal-ai/flux/schnell', defaultImageSize: 'landscape_16_9' },
  { id: 'flux-dev', label: 'Flux Dev (dengeli)', endpoint: 'fal-ai/flux/dev', defaultImageSize: 'landscape_16_9' },
  { id: 'flux-pro', label: 'Flux 1.1 Pro (premium)', endpoint: 'fal-ai/flux-pro/v1.1', defaultImageSize: 'landscape_16_9' },
  { id: 'seedream-v4', label: 'Seedream v4', endpoint: 'fal-ai/bytedance/seedream/v4/text-to-image', defaultImageSize: 'landscape_16_9' },
  { id: 'nano-banana-pro', label: 'Nano Banana Pro (Google, premium)', endpoint: 'fal-ai/nano-banana-pro', defaultImageSize: 'landscape_16_9' },
];

// ── Video modelleri (varsayılan: image-to-video) ──
export const FAL_VIDEO_MODELS = [
  { id: 'seedance-2-fast', label: 'Seedance 2.0 Fast (en ucuz · önerilen başlangıç)', endpoint: 'bytedance/seedance-2.0/fast/image-to-video', mode: 'image-to-video', durations: ['5', '10'] },
  { id: 'seedance-2', label: 'Seedance 2.0 (dengeli)', endpoint: 'bytedance/seedance-2.0/image-to-video', mode: 'image-to-video', durations: ['5', '10'] },
  { id: 'kling-v3-standard', label: 'Kling v3 Standard', endpoint: 'fal-ai/kling-video/v3/standard/image-to-video', mode: 'image-to-video', durations: ['5', '10'] },
  { id: 'kling-v3-pro', label: 'Kling v3 Pro (premium)', endpoint: 'fal-ai/kling-video/v3/pro/image-to-video', mode: 'image-to-video', durations: ['5', '10'] },
  { id: 'seedance-2-t2v', label: 'Seedance 2.0 (text-to-video, görselsiz)', endpoint: 'bytedance/seedance-2.0/text-to-video', mode: 'text-to-video', durations: ['5', '10'] },
];

export function findImageModel(id) {
  return FAL_IMAGE_MODELS.find((m) => m.id === id) || FAL_IMAGE_MODELS[0];
}
export function findVideoModel(id) {
  return FAL_VIDEO_MODELS.find((m) => m.id === id) || FAL_VIDEO_MODELS[0];
}

export async function generateImage(params = {}) {
  ensureConfigured();
  const model = findImageModel(params.model);
  const input = {
    prompt: params.prompt,
    image_size: params.image_size || params.aspect_ratio || model.defaultImageSize,
    num_images: params.num_images || 1,
  };
  if (params.seed != null && params.seed !== -1) input.seed = params.seed;
  if (params.image_url) input.image_url = params.image_url;
  if (params.negative_prompt) input.negative_prompt = params.negative_prompt;

  const result = await fal.subscribe(model.endpoint, { input, logs: false });
  const images = result?.data?.images || result?.images || [];
  return { provider: 'fal', model: model.id, endpoint: model.endpoint, url: images[0]?.url || null, images };
}

export async function generateVideo(params = {}) {
  ensureConfigured();
  const model = findVideoModel(params.model);

  const input = { prompt: params.prompt };
  if (model.mode === 'image-to-video') {
    if (!params.image_url) throw new Error(`${model.label} image-to-video — image_url zorunlu.`);
    input.image_url = params.image_url;
  }

  const rawDuration = params.duration != null ? Number(params.duration) : null;
  if (Number.isFinite(rawDuration) && model.durations.length > 0) {
    const exact = model.durations.find((d) => d === String(rawDuration));
    if (exact) input.duration = exact;
    else {
      const numeric = model.durations.map((d) => ({ raw: d, n: Number(d) })).filter((d) => Number.isFinite(d.n));
      const ge = numeric.filter((d) => d.n >= rawDuration).sort((a, b) => a.n - b.n)[0];
      const max = numeric.sort((a, b) => b.n - a.n)[0];
      input.duration = (ge || max || numeric[0]).raw;
    }
  }
  if (model.endpoint.startsWith('bytedance/seedance-2.0')) {
    input.resolution = params.resolution || '720p';
    input.aspect_ratio = params.aspect_ratio || '9:16';
    if (params.generate_audio != null) input.generate_audio = Boolean(params.generate_audio);
  } else {
    if (params.aspect_ratio) input.aspect_ratio = params.aspect_ratio;
    if (params.resolution) input.resolution = params.resolution;
  }
  if (params.negative_prompt) input.negative_prompt = params.negative_prompt;

  const result = await fal.subscribe(model.endpoint, { input, logs: false });
  const video = result?.data?.video || result?.video;
  return { provider: 'fal', model: model.id, endpoint: model.endpoint, url: video?.url || null };
}

// ── any-llm: yapılandırılmış metin üretimi (reklam copy / senaryo) ──
const LLM_MODEL = process.env.FAL_LLM_MODEL || 'openai/gpt-4o-mini';

export async function generateStructured({ system, prompt, tries = 3 }) {
  ensureConfigured();
  let lastLen = 0;
  for (let i = 0; i < tries; i++) {
    const result = await fal.subscribe('fal-ai/any-llm', {
      input: { model: LLM_MODEL, system_prompt: system, prompt, max_tokens: 4000 },
      logs: false,
    });
    const text = result?.data?.output ?? result?.output ?? '';
    lastLen = text.length;
    const parsed = extractJson(text);
    if (parsed) return parsed;
    await new Promise((r) => setTimeout(r, 800));
  }
  console.warn('[generateStructured] parse edilemedi, son yanıt uzunluğu:', lastLen);
  return null;
}

// ── Yerel görseli fal.storage'a yükle → public URL (image-to-video first-frame) ──
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

export async function uploadLocalImage(absPath) {
  ensureConfigured();
  const buf = await readFile(absPath);
  const ext = path.extname(absPath).toLowerCase();
  const type = MIME[ext] || 'image/png';
  const name = path.basename(absPath);
  return await fal.storage.upload(new File([buf], name, { type }));
}

// ── Seslendirme (fal ElevenLabs turbo-v2.5, çok dilli) ──
const TTS_ENDPOINT = process.env.FAL_TTS_ENDPOINT || 'fal-ai/elevenlabs/tts/turbo-v2.5';

// Prosody presetleri — B1: kendinden emin, sıcak, ENERJİK (donuk değil).
export const VOICE_PRESETS = {
  energetic: { stability: 0.3, similarity_boost: 0.8, style: 0.65, speed: 1.05 },
  warm: { stability: 0.45, similarity_boost: 0.82, style: 0.5, speed: 1.0 },
  calm: { stability: 0.55, similarity_boost: 0.8, style: 0.35, speed: 0.98 },
};

// Ses karakteri seçimi için aday sesler (ElevenLabs turbo-v2.5 çok dilli okur).
export const VOICE_CANDIDATES = [
  { id: 'Brian', label: 'Erkek · enerjik-otoriter', preset: 'energetic' },
  { id: 'Bill', label: 'Erkek · olgun-güven', preset: 'warm' },
  { id: 'Sarah', label: 'Kadın · sıcak-güven', preset: 'warm' },
];

export async function generateVoice({ text, voice, preset = 'energetic' }) {
  ensureConfigured();
  if (!text || !text.trim()) throw new Error('TTS: text gerekli');
  const chosen = voice || process.env.FAL_BRAND_VOICE || 'Brian';
  const p = VOICE_PRESETS[preset] || VOICE_PRESETS.energetic;
  const input = TTS_ENDPOINT.includes('elevenlabs')
    ? { text, voice: chosen, ...p }
    : { text, voice: chosen };
  const result = await fal.subscribe(TTS_ENDPOINT, { input, logs: false });
  const data = result?.data || result || {};
  const audio = data.audio || data.audio_url || result?.audio;
  const url = typeof audio === 'string' ? audio : audio?.url || null;
  if (!url) throw new Error('TTS: ses URL dönmedi');
  return { url, voice: chosen, preset, endpoint: TTS_ENDPOINT };
}

// ── Arka plan müzik (fal stable-audio; opsiyonel) ──
const MUSIC_ENDPOINT = process.env.FAL_MUSIC_ENDPOINT || 'fal-ai/stable-audio';

export async function generateMusic({ prompt, seconds = 24 }) {
  ensureConfigured();
  const input = { prompt: prompt || 'calm corporate industrial background, subtle, motivating', seconds_total: Math.min(47, Math.max(8, Math.round(seconds))) };
  const result = await fal.subscribe(MUSIC_ENDPOINT, { input, logs: false });
  const data = result?.data || result || {};
  const audio = data.audio_file || data.audio || data.audio_url;
  const url = typeof audio === 'string' ? audio : audio?.url || null;
  if (!url) throw new Error('Müzik: ses URL dönmedi');
  return { url, endpoint: MUSIC_ENDPOINT };
}

// Ham kontrol karakterlerini (ham \n vb.) boşlukla değiştir — model string içine
// koyduğunda JSON geçersiz olur. Literal kontrol karakteri kullanmadan filtrele.
function stripControlChars(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    out += code < 32 ? ' ' : s[i];
  }
  return out;
}

// Esnek JSON çıkarma: fence temizle, kontrol karakterlerini temizle, dengeli-küme tara.
function extractJson(raw) {
  if (!raw) return null;
  let text = String(raw).trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  text = stripControlChars(text);
  try { return JSON.parse(text); } catch { /* fall through */ }
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const slice = text.slice(start, i + 1);
        try { return JSON.parse(slice); } catch { /* repair */ }
        const repaired = slice.replace(/,(\s*[}\]])/g, '$1');
        try { return JSON.parse(repaired); } catch { return null; }
      }
    }
  }
  return null;
}
