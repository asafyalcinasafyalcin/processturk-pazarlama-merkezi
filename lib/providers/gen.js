// Sağlayıcı soyutlaması — üretim çağrılarını fal veya Higgsfield'a yönlendirir.
// Env: GEN_PROVIDER (genel) veya yetenek bazlı GEN_{IMAGE,VIDEO,VOICE,MUSIC,TEXT}_PROVIDER.
// HF çalışmıyorsa (credentials yok, binary yok, ağ hatası) otomatik fal'a düşer.
import * as fal from './fal.js';
import * as hf from './higgsfield.js';
import * as openai from './openai.js';
import { existsSync } from 'node:fs';

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
  return withFallback('IMAGE', () => hf.generateImage(o), () => fal.generateImage(o));
}

export async function genVideo(o) {
  return withFallback('VIDEO', () => hf.generateVideo(o), () => fal.generateVideo(o));
}

export async function genVoice(o) {
  return withFallback('VOICE', () => hf.generateVoice(o), () => fal.generateVoice(o));
}

export async function genMusic(o) {
  return withFallback('MUSIC', () => hf.generateMusic(o), () => fal.generateMusic(o));
}

export async function genStructured(o) {
  const p = genProvider('TEXT');
  if (p === 'higgsfield') return hf.generateStructured(o);
  if (p === 'fal') return fal.generateStructured(o);
  return openai.generateStructured(o);
}

export function voiceCandidates() { return isHF('VOICE') ? hf.HF_VOICE_CANDIDATES : fal.VOICE_CANDIDATES; }
