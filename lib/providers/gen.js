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

// Higgsfield credentials kontrolü (credentials.json varlığı)
function hfCredentialsOk() {
  const home = process.env.HOME || '/root';
  return existsSync(`${home}/.config/higgsfield/credentials.json`);
}

// HF'i dene; başarısız olursa fal'a düş ve uyarı logla.
async function withFallback(cap, hfFn, falFn) {
  if (!isHF(cap)) return falFn();
  if (!hfCredentialsOk()) {
    console.warn(`[gen] Higgsfield credentials yok → fal'a düşüyor (${cap})`);
    return falFn();
  }
  try {
    return await hfFn();
  } catch (e) {
    console.warn(`[gen] Higgsfield ${cap} başarısız (${e.message.slice(0, 80)}) → fal'a düşüyor`);
    return falFn();
  }
}

export async function genImage(o) {
  // image_url varsa (img2img) cache'i atla — her seferinde taze üret
  const cacheOpts = { prompt: o.prompt, model: o.model || 'gpt_image_2', ratio: o.aspect_ratio };
  if (!o.force && !o.image_url) {
    const hit = await getCached('image', cacheOpts);
    if (hit) return { ...hit, fromCache: true };
  }
  const result = await withFallback('IMAGE', () => hf.generateImage(o), () => fal.generateImage(o));
  if (!o.image_url) await setCached('image', cacheOpts, result).catch(() => {});
  return result;
}

export async function genVideo(o) {
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
  let result = null;
  const p = genProvider('VOICE');
  if (p === 'higgsfield' && hfCredentialsOk()) {
    try { result = await hf.generateVoice(o); } catch (e) {
      console.warn(`[gen] Higgsfield TTS başarısız (${e.message.slice(0, 80)}) → OpenAI TTS'e düşüyor`);
    }
  }
  if (!result) {
    try { result = await openai.generateVoice({ text: o.text, lang: o.lang }); } catch (e) {
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
