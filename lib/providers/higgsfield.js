// Higgsfield CLI sağlayıcısı — fal'a alternatif üretim motoru. `higgsfield generate create`
// komutunu sarar. Medya flag'leri (--image) yerel dosya yolunu otomatik yükler.
// fal.js ile aynı imzaları döndürür ({url, ...}) → gen.js dispatcher ile değiştirilebilir.
import { spawn } from 'node:child_process';

const HF = process.env.HIGGSFIELD_BIN || 'higgsfield';
const TTS_MODEL = process.env.HF_TTS_MODEL || 'elevenlabs';

function runHF(args, { timeoutMs = 1200000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(HF, [...args, '--json', '--no-color'], { timeout: timeoutMs });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`higgsfield ${code}: ${(err || out).slice(-400)}`));
      resolve(out);
    });
  });
}

// JSON çıktıdan ilk medya URL'sini (uzantıya göre) özyinelemeli bul
function findUrl(node, exts) {
  if (node == null) return null;
  if (typeof node === 'string') {
    const m = node.match(/https?:\/\/[^\s"']+/);
    if (m && exts.some((e) => m[0].toLowerCase().split('?')[0].endsWith(e))) return m[0];
    return null;
  }
  if (Array.isArray(node)) { for (const x of node) { const u = findUrl(x, exts); if (u) return u; } return null; }
  if (typeof node === 'object') {
    // öncelik: result/output/url/media alanları
    for (const k of ['url', 'result_url', 'output_url', 'media_url', 'video_url', 'audio_url', 'image_url']) {
      if (typeof node[k] === 'string') { const u = findUrl(node[k], exts); if (u) return u; }
    }
    for (const v of Object.values(node)) { const u = findUrl(v, exts); if (u) return u; }
  }
  return null;
}

function parseResult(stdout, exts) {
  let data = null;
  try { data = JSON.parse(stdout); } catch {
    const i = stdout.lastIndexOf('{'); // son JSON objesi
    if (i >= 0) { try { data = JSON.parse(stdout.slice(i)); } catch { /* */ } }
  }
  const url = findUrl(data ?? stdout, exts);
  if (!url) throw new Error('Higgsfield: sonuç URL bulunamadı');
  return { url, raw: data };
}

const IMG = ['.png', '.jpg', '.jpeg', '.webp'];
const VID = ['.mp4', '.mov', '.webm'];
const AUD = ['.mp3', '.wav', '.m4a', '.aac', '.ogg'];

// Yüklenen medyanın ilk kaydını bul (upload create → obje; upload list → dizi)
function firstUpload(stdout) {
  let data = null;
  try { data = JSON.parse(stdout); } catch {
    const k = Math.max(stdout.lastIndexOf('['), stdout.lastIndexOf('{'));
    if (k >= 0) { try { data = JSON.parse(stdout.slice(k)); } catch { /* */ } }
  }
  const obj = Array.isArray(data) ? data[0] : data;
  return obj && typeof obj.id === 'string' ? obj : null;
}

// Yerel medyayı ÖNCE ayrı yükle → upload id döndür (sonra `generate --image <id>`).
// Inline `generate --image <yol>` auto-upload'u CLI'nın yükleme-sonrası erişilebilirlik
// kontrolüne (presigned URL content-type imzalı header ister → 403, hata "Cannot reach")
// ARALIKLI takılır. Strateji: upload create'i birkaç kez dene; başarısızsa dosya yine de
// S3'e yazılıp kaydolduğu için listeden en YENİ (taze) id'ye düş.
async function uploadMedia(filePath) {
  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      const u = firstUpload(await runHF(['upload', 'create', filePath]));
      if (u) return u.id;
    } catch (e) { lastErr = e; }
    await new Promise((r) => setTimeout(r, 1500));
  }
  // Son çare: en yeni kayıt (son ~3 dk içinde oluştuysa bizimkidir)
  const u = firstUpload(await runHF(['upload', 'list', '--image', '--size', '1']));
  const fresh = u && (!u.created_at || (Date.now() / 1000 - u.created_at) < 180);
  if (!fresh) throw new Error(`Higgsfield upload başarısız: ${lastErr?.message || 'id yok'}`);
  return u.id;
}

// HF görsel modelleri (fal model adları — flux-dev vb. — buraya UYMAZ → varsayılana düşülür).
const HF_IMAGE_MODELS = ['gpt_image_2', 'flux_2', 'flux_kontext', 'grok_image', 'text2image_soul_v2', 'nano_banana_2_pro', 'image_auto', 'cinematic_studio_image'];
// gpt_image_2 izinli oranlar; 4:5 gibi fal oranları en yakın geçerli orana eşlenir.
const HF_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'];
const RATIO_MAP = { '4:5': '3:4', '5:4': '4:3', '2:1': '16:9', '1:2': '9:16', '21:9': '16:9' };
function hfRatio(r) { return HF_RATIOS.includes(r) ? r : (RATIO_MAP[r] || '3:4'); }

export async function generateImage({ prompt, aspect_ratio = '9:16', model = 'gpt_image_2', soul_id, reference_image }) {
  let hfModel = HF_IMAGE_MODELS.includes(model) ? model : 'gpt_image_2';
  // Soul ID varsa → text2image_soul_v2'ye zorla
  if (soul_id) hfModel = 'text2image_soul_v2';
  // Referans görsel varsa (Soul ID yoksa) → nano_banana_2_pro'ya zorla
  else if (reference_image) hfModel = 'nano_banana_2_pro';

  const ratio = hfRatio(aspect_ratio);
  const args = ['generate', 'create', hfModel, '--prompt', prompt, '--aspect_ratio', ratio, '--wait', '--wait-timeout', '10m'];
  if (soul_id) args.push('--soul-id', soul_id);
  if (reference_image) {
    const imgRef = reference_image.startsWith('http') ? reference_image : await uploadMedia(reference_image);
    args.push('--image', imgRef);
  }
  const out = await runHF(args);
  const r = parseResult(out, IMG);
  return { provider: 'higgsfield', model: hfModel, url: r.url };
}

// image-to-video: imagePath (yerel → ayrı upload id'ye çevrilir) veya image_url
export async function generateVideo({ prompt, imagePath, image_url, aspect_ratio = '9:16', duration = 10, resolution = '720p', generate_audio = false }) {
  // Platform aralıklı 500/boş-sonuç verebildiği için geçici hatalarda yeniden dene.
  // Görseli HER denemede taze yükle (önceki denemenin kırık upload id'sini tekrar kullanma).
  const transient = /HTTP 5\d\d|Internal Server Error|cannot reach|sonuç URL bulunamadı|timeout|\bch https?:/i;
  let r = null, lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      let imageRef = null;
      if (imagePath) imageRef = await uploadMedia(imagePath);
      else if (image_url) imageRef = image_url;
      const args = ['generate', 'create', 'seedance_2_0', '--prompt', prompt || 'cinematic product video',
        '--aspect_ratio', aspect_ratio, '--duration', String(duration), '--resolution', resolution,
        '--generate_audio', String(Boolean(generate_audio))];
      if (imageRef) args.push('--image', imageRef);
      r = parseResult(await runHF(args, { timeoutMs: 1500000 }), VID);
      break;
    } catch (e) {
      lastErr = e;
      if (i === 2 || !transient.test(e.message)) throw e;
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
  if (!r) throw lastErr;
  return { provider: 'higgsfield', model: 'seedance_2_0', url: r.url };
}

// Dil başına varsayılan ses karakteri (HF preset UUID'leri, ElevenLabs turbo-v2.5)
export const LANG_VOICE_MAP = {
  tr: '7e63ac18-5fcd-4aba-8078-a86d4e11c127',  // Roman — erkek, enerjik
  en: 'c2acff45-84b2-4974-892d-89fa2d4e5598',  // Brooks — erkek, sıcak
  ar: '530df032-c311-483b-a750-cb3c9e1bcdfd',  // Gia   — kadın, sıcak
  fr: 'c2acff45-84b2-4974-892d-89fa2d4e5598',  // Brooks
  ru: '7e63ac18-5fcd-4aba-8078-a86d4e11c127',  // Roman
};

export async function generateVoice({ text, voice, voiceId, lang }) {
  // Dil başına ses karakteri → kullanıcı ayarı → env → hata
  const id = voiceId || voice || LANG_VOICE_MAP[lang] || LANG_VOICE_MAP.tr || process.env.HF_VOICE_ID;
  if (!id) throw new Error('Higgsfield TTS: voice_id gerekli (Ayarlar\'dan seç).');
  const out = await runHF(['generate', 'create', 'text2speech_v2', '--model', TTS_MODEL,
    '--voice_id', id, '--voice_type', 'preset', '--prompt', text, '--wait', '--wait-timeout', '8m']);
  const r = parseResult(out, AUD);
  return { provider: 'higgsfield', model: 'text2speech_v2', voice: id, lang, url: r.url };
}

export async function generateMusic({ prompt, seconds = 20 }) {
  const out = await runHF(['generate', 'create', 'sonilo_music', '--prompt', prompt || 'calm corporate background',
    '--duration', String(Math.round(seconds)), '--wait', '--wait-timeout', '8m']);
  const r = parseResult(out, AUD);
  return { provider: 'higgsfield', model: 'sonilo_music', url: r.url };
}

// Yapılandırılmış metin (llm_text). Higgsfield LLM JSON güvenilirliği değişken → gen.js
// fal'a düşebilir. Burada best-effort.
export async function generateStructured({ system, prompt }) {
  const model = process.env.HF_LLM_MODEL || 'gpt-4o-mini';
  const out = await runHF(['generate', 'create', 'llm_text', '--model', model, '--system_prompt', system, '--user_prompt', prompt, '--wait', '--wait-timeout', '5m']);
  let data = null; try { data = JSON.parse(out); } catch { /* */ }
  // llm_text çıktısındaki metni bul
  const text = (function find(n) {
    if (typeof n === 'string') return n;
    if (Array.isArray(n)) { for (const x of n) { const t = find(x); if (t) return t; } }
    if (n && typeof n === 'object') { for (const k of ['text', 'output', 'result', 'content']) if (typeof n[k] === 'string') return n[k]; for (const v of Object.values(n)) { const t = find(v); if (t) return t; } }
    return null;
  })(data ?? out);
  if (!text) return null;
  try { return JSON.parse(text); } catch {
    const i = text.indexOf('{'), j = text.lastIndexOf('}');
    if (i >= 0 && j > i) { try { return JSON.parse(text.slice(i, j + 1)); } catch { return null; } }
    return null;
  }
}

// Ses örneği adayları (Higgsfield preset voice_id'leri)
export const HF_VOICE_CANDIDATES = [
  { id: '7e63ac18-5fcd-4aba-8078-a86d4e11c127', label: 'Roman · erkek', preset: 'energetic' },
  { id: 'c2acff45-84b2-4974-892d-89fa2d4e5598', label: 'Brooks · erkek', preset: 'warm' },
  { id: '530df032-c311-483b-a750-cb3c9e1bcdfd', label: 'Gia · kadın', preset: 'warm' },
];
