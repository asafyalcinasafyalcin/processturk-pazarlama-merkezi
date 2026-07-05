// Sağlayıcı soyutlaması — üretim çağrılarını fal veya Higgsfield'a yönlendirir.
// Env: GEN_PROVIDER (genel) veya yetenek bazlı GEN_{IMAGE,VIDEO,VOICE,MUSIC,TEXT}_PROVIDER.
// HF çalışmıyorsa (credentials yok, binary yok, ağ hatası) otomatik fal'a düşer.
import * as fal from './fal.js';
import * as hf from './higgsfield.js';
import * as openai from './openai.js';
import { existsSync } from 'node:fs';
import { getCached, setCached } from '../gen-cache.js';

export function genProvider(cap) {
  return (process.env[`GEN_${cap}_PROVIDER`] || process.env.GEN_PROVIDER || 'fal').toLowerCase();
}
const isHF = (cap) => genProvider(cap) === 'higgsfield';

const isHttp = (v) => typeof v === 'string' && /^https?:\/\//.test(v);

// Sistem Higgsfield üzerine kurulu — kaynak görseller HF'in kendi native upload'ıyla
// (higgsfield.js uploadMedia) yüklenir. fal yalnızca BAKİYE VARSA sessiz yedektir.
// fal yedeği için yerel dosyayı fal.storage'a çevir (yalnız fal kullanılacaksa çağrılır).
async function toFalUrl(localOrUrl) {
  if (!localOrUrl) return null;
  if (isHttp(localOrUrl)) return localOrUrl;
  if (!existsSync(localOrUrl)) return null;
  try { return await fal.uploadLocalImage(localOrUrl); }
  catch (e) { console.warn('[gen] fal.storage upload atlandı (fal devre dışı?):', e.message?.slice(0, 80)); return null; }
}

// fal'ın "ölü" olduğunu gösteren hatalar (bakiye bitti / kilitli / 403) — bunlar yedeğin
// kullanılamadığı anlamına gelir, kullanıcıya "Forbidden" diye yansıtılmamalı.
const FAL_DEAD = /403|forbidden|exhausted balance|user is locked|unauthorized|insufficient/i;

// Higgsfield credentials kontrolü (credentials.json varlığı)
function hfCredentialsOk() {
  const home = process.env.HOME || '/root';
  return existsSync(`${home}/.config/higgsfield/credentials.json`);
}

// HF'i dene; başarısızsa fal'ı SESSİZ yedek olarak dene. fal da ölüyse (bakiye/403)
// kullanıcıya HF'in GERÇEK hatasını göster ("Forbidden" maskelemesi yok).
async function withFallback(cap, hfFn, falFn) {
  return withFallbackFor(isHF(cap), hfFn, falFn, cap);
}

// Motor seçimini doğrudan boolean ile yapan varyant (çağrı-başına provider override için).
// wantHF=false → direkt fal. wantHF=true → HF (credentials kontrollü) + fal sessiz yedek.
async function withFallbackFor(wantHF, hfFn, falFn, label = 'IMAGE') {
  if (!wantHF) return falFn();
  if (!hfCredentialsOk()) {
    console.warn(`[gen] Higgsfield credentials yok → fal yedeği deneniyor (${label})`);
    return falFn();
  }
  try {
    return await hfFn();
  } catch (hfErr) {
    console.warn(`[gen] Higgsfield ${label} başarısız (${hfErr.message.slice(0, 100)}) → fal yedeği deneniyor`);
    try {
      return await falFn();
    } catch (falErr) {
      if (FAL_DEAD.test(falErr.message)) {
        // fal bakiyesi yok/kilitli → asıl sorun HF'te; HF hatasını göster.
        throw hfErr;
      }
      throw falErr;
    }
  }
}

// Çağrı-başına motor override'ını çöz: o.provider ('fal'|'higgsfield') varsa onu kullan,
// yoksa env tabanlı varsayılana (isHF) düş.
function wantHFfor(cap, o) {
  if (o && typeof o.provider === 'string') return o.provider.toLowerCase() === 'higgsfield';
  return isHF(cap);
}

export async function genImage(o) {
  // Çağrı-başına motor seçimi (UI düğmesi → o.provider); yoksa env varsayılanı.
  const wantHF = wantHFfor('IMAGE', o);
  // fal yedeğe düşülecekse img2img kaynağını fal.storage URL'ine çevir (HF native upload'ı bozmaz:
  // http reference_image'ı HF de doğrudan kullanır). HF birincilse yerel yol native upload'a gider.
  if (!wantHF && o.reference_image && !isHttp(o.reference_image)) {
    const url = await toFalUrl(o.reference_image);
    if (url) o = { ...o, reference_image: url, image_url: isHttp(o.image_url) ? o.image_url : url };
  }
  const isImg2Img = Boolean(o.reference_image || o.image_url);
  // img2img'de cache'i atla — her seferinde taze üret
  const cacheOpts = { prompt: o.prompt, model: o.model || 'gpt_image_2', ratio: o.aspect_ratio, provider: wantHF ? 'hf' : 'fal' };
  if (!o.force && !isImg2Img) {
    const hit = await getCached('image', cacheOpts);
    if (hit) return { ...hit, fromCache: true };
  }
  const result = await withFallbackFor(wantHF, () => hf.generateImage(o), () => fal.generateImage(o), 'IMAGE');
  if (!isImg2Img) await setCached('image', cacheOpts, result).catch(() => {});
  return result;
}

export async function genVideo(o) {
  // fal yedeğe düşülecekse kaynak görseli fal.storage URL'ine çevir (image-to-video image_url zorunlu).
  // HF birincilse imagePath (yerel) korunur → HF native upload kullanır.
  if (!isHF('VIDEO')) {
    if (o.imagePath && !isHttp(o.image_url)) {
      const url = await toFalUrl(o.imagePath);
      if (url) o = { ...o, image_url: url };
    } else if (o.image_url && !isHttp(o.image_url)) {
      const url = await toFalUrl(o.image_url);
      o = { ...o, image_url: url || undefined };
    }
  }
  // imagePath/image_url cache key'e dahil edilmez — aynı ürün farklı upload id ile tekrar üretmesin.
  const cacheOpts = { prompt: o.prompt, model: o.model || 'seedance_2_0', ratio: o.aspect_ratio, duration: o.duration };
  if (!o.force) {
    const hit = await getCached('video', cacheOpts);
    if (hit) return { ...hit, fromCache: true };
  }
  const result = await withFallback('VIDEO', () => hf.generateVideo(o), () => fal.generateVideo(o));
  await setCached('video', cacheOpts, result).catch(() => {});
  return result;
}

export async function genVoice(o) {
  const cacheOpts = { text: o.text, voiceId: o.voiceId || o.voice, lang: o.lang };
  if (!o.force) {
    const hit = await getCached('voice', cacheOpts);
    if (hit) return { ...hit, fromCache: true };
  }
  // Öncelik: Higgsfield TTS (dahil) → OpenAI TTS (yedek) → fal.ai (opsiyonel)
  // voiceStyle='maskot' → direkt OpenAI onyx (robot sesi HF preset'lerde yok)
  let result = null;
  const p = genProvider('VOICE');
  const isMaskot = o.voiceStyle === 'maskot';
  if (!isMaskot && p === 'higgsfield' && hfCredentialsOk()) {
    try { result = await hf.generateVoice(o); } catch (e) {
      console.warn(`[gen] Higgsfield TTS başarısız (${e.message.slice(0, 80)}) → OpenAI TTS'e düşüyor`);
    }
  }
  if (!result) {
    try {
      const voice = isMaskot ? 'onyx' : undefined;
      const speed = isMaskot ? 1.15 : (o.voiceStyle === 'satis' ? 1.1 : 1.0);
      result = await openai.generateVoice({ text: o.text, lang: o.lang, voice, speed });
    } catch (e) {
      console.warn(`[gen] OpenAI TTS başarısız (${e.message.slice(0, 80)}) → fal.ai'ye düşüyor`);
    }
  }
  if (!result) {
    result = await fal.generateVoice(o);
  }
  await setCached('voice', cacheOpts, result).catch(() => {});
  return result;
}

export async function genMusic(o) {
  const cacheOpts = { prompt: o.prompt, seconds: Math.round((o.seconds || 20) / 5) * 5 };
  if (!o.force) {
    const hit = await getCached('music', cacheOpts);
    if (hit) return { ...hit, fromCache: true };
  }
  const result = await withFallback('MUSIC', () => hf.generateMusic(o), () => fal.generateMusic(o));
  await setCached('music', cacheOpts, result).catch(() => {});
  return result;
}

export async function genStructured(o) {
  const p = genProvider('TEXT');
  if (p === 'higgsfield') return hf.generateStructured(o);
  if (p === 'fal') return fal.generateStructured(o);
  return openai.generateStructured(o);
}

export function voiceCandidates() { return isHF('VOICE') ? hf.HF_VOICE_CANDIDATES : fal.VOICE_CANDIDATES; }
