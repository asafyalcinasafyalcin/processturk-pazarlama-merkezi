// OpenAI yapılandırılmış metin + TTS sağlayıcısı.
// OPENAI_API_KEY .env.local'dan (icerik-ajani ile aynı anahtar).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-4o';

export async function generateStructured({ system, prompt }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY tanımlı değil (.env.local).');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system + ' Yanıtı GEÇERLİ tek bir JSON nesnesi olarak ver.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
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
