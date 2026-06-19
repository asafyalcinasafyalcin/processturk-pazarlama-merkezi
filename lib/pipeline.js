import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import { dataDir, stateFile } from './paths.js';

// FAZ 2 — Aşamalı üretim hattı durumu (ürün × dil × aşama).
// Aşama zinciri: text → (voice, subtitle, video). Her aşama yalnız ONAYLI üst aşamadan
// üretilir. Üst aşama değişince alt aşamalar "güncel değil" (stale) işaretlenir ama
// OTOMATİK yeniden üretilmez → tekrar ücret yok. Yalnız elle yeniden üretilen ücretlenir.
//
// content.json şekli (mevcut copy/video korunur):
//   "<slug>": { copy, video(legacy), pipelines: { "<lang>": { text, voice, subtitle, video } } }
// Aşama: { status:'empty'|'draft'|'approved', data, inputHash, cost, at }

const FILE = () => stateFile('content.json');
export const STAGES = ['text', 'voice', 'subtitle', 'video'];

// Tahmini birim maliyet (USD, fal fiyatından kaba) — gerçek fatura değil.
export const STAGE_COST = { text: 0.002, voice: 0.03, subtitle: 0, video: 0.35 };

function emptyStage() { return { status: 'empty', data: null, inputHash: null, cost: 0, at: null }; }
function emptyPipeline() { return { text: emptyStage(), voice: emptyStage(), subtitle: emptyStage(), video: emptyStage() }; }

export function hashOf(obj) {
  return crypto.createHash('sha1').update(JSON.stringify(obj ?? null)).digest('hex').slice(0, 16);
}

async function readAll() {
  try { return JSON.parse(await fs.readFile(FILE(), 'utf-8')) || {}; }
  catch (e) { if (e.code === 'ENOENT') return {}; throw e; }
}
async function writeAll(all) {
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(FILE(), JSON.stringify(all, null, 2) + '\n', 'utf-8');
}

export async function readPipeline(slug, lang) {
  const all = await readAll();
  const p = all[slug]?.pipelines?.[lang];
  return p ? { ...emptyPipeline(), ...p } : emptyPipeline();
}

async function mutate(slug, lang, fn) {
  const all = await readAll();
  if (!all[slug]) all[slug] = {};
  if (!all[slug].pipelines) all[slug].pipelines = {};
  const pipe = { ...emptyPipeline(), ...(all[slug].pipelines[lang] || {}) };
  fn(pipe);
  all[slug].pipelines[lang] = pipe;
  all[slug].updated_at = new Date().toISOString();
  await writeAll(all);
  return pipe;
}

// Üst aşamanın ONAYLI imzası (alt aşamanın hangi girdiyle üretildiğini kıyaslamak için).
// Üst aşama onaylı değilse null → alt aşama üretilemez.
export function upstreamHash(pipe, stage) {
  const t = pipe.text;
  if (stage === 'voice' || stage === 'subtitle') {
    return t.status === 'approved' ? hashOf(stage === 'voice' ? t.data?.voiceover : t.data?.scenes) : null;
  }
  if (stage === 'video') {
    if (t.status !== 'approved') return null;
    const voicePart = pipe.voice.status === 'approved' ? pipe.voice.data?.url : null;
    return hashOf([t.data?.scenes, voicePart]);
  }
  return ''; // text: üst yok
}

// Her aşama için durum + stale + üretilebilir mi
export function computeStatus(pipe) {
  const out = {};
  for (const st of STAGES) {
    const s = pipe[st];
    const up = upstreamHash(pipe, st);
    const blocked = up === null;                 // üst onaylı değil
    const stale = s.status !== 'empty' && up !== '' && up !== null && s.inputHash !== up;
    out[st] = { status: s.status, stale, blocked, cost: s.cost, at: s.at, hasData: Boolean(s.data) };
  }
  return out;
}

function pushVersion(prev, data, cost, note) {
  const versions = Array.isArray(prev.versions) ? prev.versions.slice(-19) : []; // son 20 sürüm
  const vid = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  versions.push({ vid, data, cost, at: new Date().toISOString(), note: note || null });
  return { versions, vid };
}

// FAZ 3 — yeni üretim ESKİYİ EZMEZ: her üretim/düzenleme yeni sürüm olarak eklenir.
export async function setStageDraft(slug, lang, stage, data, cost) {
  return mutate(slug, lang, (pipe) => {
    const up = upstreamHash(pipe, stage);
    const { versions, vid } = pushVersion(pipe[stage], data, cost ?? STAGE_COST[stage] ?? 0);
    pipe[stage] = { status: 'draft', data, inputHash: up === '' ? null : up, cost: cost ?? STAGE_COST[stage] ?? 0, at: new Date().toISOString(), versions, currentVid: vid };
  });
}

export async function editStageDraft(slug, lang, stage, data) {
  return mutate(slug, lang, (pipe) => {
    const cur = pipe[stage];
    const merged = { ...(cur.data || {}), ...data };
    const { versions, vid } = pushVersion(cur, merged, 0, 'elle düzenleme');
    pipe[stage] = { ...cur, status: 'draft', data: merged, at: new Date().toISOString(), versions, currentVid: vid };
  });
}

// Eski bir sürümü geri yükle (yeni üretim yapmaz, ücret yok). status→draft (yeniden onay gerek).
export async function restoreVersion(slug, lang, stage, vid) {
  return mutate(slug, lang, (pipe) => {
    const cur = pipe[stage];
    const v = (cur.versions || []).find((x) => x.vid === vid);
    if (!v) throw new Error('Sürüm bulunamadı');
    const up = upstreamHash(pipe, stage);
    pipe[stage] = { ...cur, status: 'draft', data: v.data, inputHash: up === '' ? null : up, at: new Date().toISOString(), currentVid: vid };
  });
}

// FAZ 3 — Varlık Kütüphanesi: bir ürünün tüm dil×aşama sürümlerini düz liste yapar.
function assetPreview(stage, data) {
  if (!data) return {};
  if (stage === 'text') return { summary: data.hook || (data.voiceover || '').slice(0, 60) };
  if (stage === 'voice' || stage === 'video') return { url: data.url || null };
  if (stage === 'subtitle') return { srt: data.srt || null, cues: data.cues?.length || 0 };
  return {};
}

export async function listAllAssets(slug) {
  const all = await readAll();
  const pipelines = all[slug]?.pipelines || {};
  const out = [];
  for (const [lang, pipe] of Object.entries(pipelines)) {
    for (const stage of STAGES) {
      const s = pipe[stage];
      if (!s || !Array.isArray(s.versions)) continue;
      for (const v of s.versions) {
        out.push({
          lang, stage, vid: v.vid, at: v.at, cost: v.cost || 0, note: v.note || null,
          isCurrent: s.currentVid === v.vid,
          stageStatus: s.status,
          ...assetPreview(stage, v.data),
        });
      }
    }
  }
  out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return out;
}

export async function approveStage(slug, lang, stage) {
  return mutate(slug, lang, (pipe) => {
    if (pipe[stage].status === 'empty') throw new Error('Önce bu aşamayı üret.');
    pipe[stage].status = 'approved';
    // onaylı imzayı tazele (kendi üst aşamasına göre)
    const up = upstreamHash(pipe, stage);
    if (up !== '') pipe[stage].inputHash = up;
  });
}
