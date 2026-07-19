// OpenAI yapılandırılmış metin + TTS sağlayıcısı.
// OPENAI_API_KEY .env.local'dan (icerik-ajani ile aynı anahtar).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { sohbet, LLMHatasi } from '../llm-koprusu.mjs';

const MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-4o';

// ── GÖRSEL: gpt-image-1 ──────────────────────────────────────────────────────
// Paandaa Studio'da kanıtlanan yol (PZ kararı 2026-07-07): reference_image (yerel dosya
// yolu) varsa /v1/images/edits (makine korunur, sahne/ışık değişir); yoksa
// /v1/images/generations. Dönüş fal.js imzasıyla uyumlu ({ provider, model, url, b64 }) —
// gpt-image-1 CDN URL değil base64 döndürür; çağıran b64'ü storage'a yazar (route.js).
const OAI_SIZES = ['1024x1024', '1536x1024', '1024x1536', 'auto'];

function nearestSize(imageSize, aspectRatio) {
  const s = String(imageSize || aspectRatio || '').toLowerCase();
  if (OAI_SIZES.includes(s)) return s;
  if (/portrait|9:16|3:4|4:5|1024x1536/.test(s)) return '1024x1536';
  if (/landscape|16:9|4:3|3:2|1536x1024/.test(s)) return '1536x1024';
  if (/square|1:1/.test(s)) return '1024x1024';
  return 'auto';
}

export async function generateImage(params = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY tanımlı değil (.env.local).');
  const model = params.model && /^gpt-image/.test(params.model) ? params.model : 'gpt-image-1';
  const size = nearestSize(params.image_size, params.aspect_ratio);
  const quality = params.quality || 'high'; // low | medium | high (premium tier → high)
  const ref = params.reference_image && !/^https?:/.test(params.reference_image) && fs.existsSync(params.reference_image)
    ? params.reference_image : null;

  let res;
  if (ref) {
    // image-edit: gerçek ürün fotoğrafı referans — makine korunur, sahne/ışık değişir
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', params.prompt);
    form.append('size', size);
    form.append('quality', quality);
    const buf = fs.readFileSync(ref);
    const mime = /\.png$/i.test(ref) ? 'image/png' : 'image/jpeg';
    form.append('image[]', new File([buf], path.basename(ref), { type: mime }));
    res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form,
    });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, prompt: params.prompt, size, quality, n: 1 }),
    });
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI images ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json || null;
  const url = data?.data?.[0]?.url || null;
  if (!b64 && !url) throw new Error('gpt-image-1: görsel dönmedi');
  return { provider: 'openai', model, endpoint: ref ? 'images/edits' : 'images/generations', url, b64, quality, size, usedReference: Boolean(ref) };
}

// ── GÖÇ NOTU (2026-07-19): YALNIZ bu metin (chat) fonksiyonu LLM köprüsüne
// (../llm-koprusu.mjs) taşındı. Görsel (images/generations + images/edits,
// gpt-image-1) ve TTS (audio/speech) çağrıları KÖPRÜ KAPSAMI DIŞINDADIR ve
// bilerek AYNEN bırakıldı — köprü yalnız metin+embedding taşır.
// DAVRANIŞ KORUNDU: aynı model env adı (OPENAI_TEXT_MODEL, açıkça geçilir),
// aynı varsayılan (gpt-4o), aynı sıcaklık (0.8) / max_tokens (2000), aynı
// json_object modu, anahtar yoksa yine aynı Error, HTTP hatasında yine aynı
// biçimli `OpenAI <kod>: <gövde200>` Error'u, JSON ayrıştırılamazsa yine null.
// denemeler:0 → eski kod da geçici hatada yeniden denemiyordu.
export async function generateStructured({ system, prompt }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY tanımlı değil (.env.local).');
  let text = '';
  try {
    const y = await sohbet({
      sistem: system + ' Yanıtı GEÇERLİ tek bir JSON nesnesi olarak ver.',
      mesajlar: [{ rol: 'kullanici', icerik: prompt }],
      model: MODEL,
      json: true,
      sicaklik: 0.8,
      maxToken: 2000,
      denemeler: 0,
    });
    text = y.metin || '';
  } catch (e) {
    // Köprü JSON ayrıştıramazsa hata atar; eski davranış NULL döndürmekti → koru.
    if (e instanceof LLMHatasi && e.durum == null && /JSON istendi/.test(e.message)) return null;
    if (e instanceof LLMHatasi && e.durum) {
      throw new Error(`OpenAI ${e.durum}: ${String(e.govde ?? '').slice(0, 200)}`);
    }
    throw e;
  }
  try { return JSON.parse(text); } catch {
    const i = text.indexOf('{'), j = text.lastIndexOf('}');
    if (i >= 0 && j > i) { try { return JSON.parse(text.slice(i, j + 1)); } catch { return null; } }
    return null;
  }
}

// Dil başına OpenAI TTS ses karakterleri (yedek olarak kullanılır)
const TTS_VOICE_MAP = { tr: 'onyx', en: 'onyx', ar: 'nova', fr: 'echo', ru: 'alloy' };

export async function generateVoice({ text, lang = 'tr', voice: voiceOverride, speed = 1.0 }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY tanımlı değil (.env.local).');
  const voice = voiceOverride || TTS_VOICE_MAP[lang] || 'onyx';
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'tts-1-hd', voice, input: text, speed: Math.min(Math.max(speed, 0.25), 4.0) }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI TTS ${res.status}: ${t.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const tmpFile = path.join(os.tmpdir(), `oai-tts-${Date.now()}.mp3`);
  fs.writeFileSync(tmpFile, buf);
  // Dosyayı public/generated/ses klasörüne taşı
  const dir = path.join(process.cwd(), 'public', 'generated', '_tts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `tts-${lang}-${Date.now()}.mp3`;
  const dest = path.join(dir, filename);
  fs.copyFileSync(tmpFile, dest);
  fs.unlinkSync(tmpFile);
  return { provider: 'openai', model: 'tts-1-hd', voice, lang, url: `/generated/_tts/${filename}`, localPath: `/generated/_tts/${filename}` };
}
