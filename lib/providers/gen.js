// Sağlayıcı soyutlaması — üretim çağrılarını fal veya Higgsfield'a yönlendirir.
// Env: GEN_PROVIDER (genel) veya yetenek bazlı GEN_{IMAGE,VIDEO,VOICE,MUSIC,TEXT}_PROVIDER.
// fal kilitliyken GEN_PROVIDER=higgsfield ile tüm motor Higgsfield'a geçer.
import * as fal from './fal.js';
import * as hf from './higgsfield.js';
import * as openai from './openai.js';

export function genProvider(cap) {
  return (process.env[`GEN_${cap}_PROVIDER`] || process.env.GEN_PROVIDER || 'fal').toLowerCase();
}
const isHF = (cap) => genProvider(cap) === 'higgsfield';

export async function genImage(o) { return isHF('IMAGE') ? hf.generateImage(o) : fal.generateImage(o); }
export async function genVideo(o) { return isHF('VIDEO') ? hf.generateVideo(o) : fal.generateVideo(o); }
export async function genVoice(o) { return isHF('VOICE') ? hf.generateVoice(o) : fal.generateVoice(o); }
export async function genMusic(o) { return isHF('MUSIC') ? hf.generateMusic(o) : fal.generateMusic(o); }
export async function genStructured(o) {
  // Metin (LLM): OpenAI varsayılan (güvenilir JSON, kredi yemez). GEN_TEXT_PROVIDER ile değiştir.
  const p = genProvider('TEXT');
  if (p === 'higgsfield') return hf.generateStructured(o);
  if (p === 'fal') return fal.generateStructured(o);
  return openai.generateStructured(o); // 'openai' veya varsayılan
}

export function voiceCandidates() { return isHF('VOICE') ? hf.HF_VOICE_CANDIDATES : fal.VOICE_CANDIDATES; }
