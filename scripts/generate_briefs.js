#!/usr/bin/env node
/**
 * generate_briefs.js — 13 ürün için GPT-4o ile brief taslağı üretir.
 * Kullanım: node scripts/generate_briefs.js [--force]
 *
 * --force : Mevcut onaylı (approved:true) brief'leri de üzerine yazar.
 *
 * Üretilen brief dosyaları approved:false ile kaydedilir.
 * Asaf panelde inceleyip onaylar.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Marka motoru (env BRAND_ID) — brief prompt'undaki marka adı/bağlamı buradan gelir;
// BRAND_ID yoksa ProcessTürk varsayılanı (canlı davranış korunur).
import { BRAND } from '../lib/brand.js';
import { websiteBriefSource } from '../lib/website-brief.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PRODUCTS_PATH = path.join(ROOT, 'data', 'products.json');
const BRIEFS_DIR    = path.join(ROOT, 'data', 'briefs');
const KB_PATH       = path.resolve(ROOT, '../../_core/knowledge-base/PROCESSTURK_MASTER_KNOWLEDGE_BASE.md');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('⛔ OPENAI_API_KEY env değişkeni eksik. .env.local\'dan export edin.');
  process.exit(1);
}

const FORCE = process.argv.includes('--force');

async function callGPT(system, prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1000,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error?.message || res.statusText);
  return JSON.parse(d.choices[0].message.content);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function generateBrief(product, kbExcerpt) {
  const m = product.marketing || {};
  const specLines = Object.entries(product.specs || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const marka = BRAND.promptName || BRAND.name;
  const markaBaglam = BRAND.briefContext
    || `${marka} Türkiye'de üretim yapıyor, küresel sevkiyat sunuyor, 7/24 uzaktan destek veriyor.`;
  const system = [
    `Sen ${marka} için ürün pazarlama brief'i oluşturuyorsun.`,
    markaBaglam,
    'Çıktılar sosyal medya metin ve video içeriklerinde kullanılacak.',
    'KURAL: Fiyat bilgisi asla yazma. "Avrupa menşeli", "ithal parça", "en ucuz" deme.',
    'TOPRAKLAMA: Web sitesi verisi bölümü varsa o RESMİ kaynaktır — sadece verilen bilgileri kullan, kaynakta olmayan kapasite/özellik/iddia uydurma.',
    '"Türk mühendisliği", "7/24 uzaktan destek", "küresel sevkiyat" serbest.',
    'SADECE minified JSON döndür — açıklama, markdown yok.',
  ].join(' ');

  const schema = JSON.stringify({
    highlights: ['3-5 kısa teknik özellik/fark/sonuç cümlesi — BUNLAR sosyal medya içeriğinde ana kancayı oluşturacak'],
    target_industries: ['2-4 sektör/uygulama alanı'],
    ideal_customer: 'Hedef müşteri tek cümle portresi',
    pain_points: ['2-3 müşterinin çözmek istediği sorun'],
    dont_say: ['kesinlikle içerikte geçmemesi gereken ifadeler — örnek: "Avrupa teknolojisi", "ithal", "en ucuz"'],
    image_notes: 'Görsel üretimi için ürünü/ortamı tanımlayan not (renk, materyal, kullanım ortamı)',
  });

  // Web sitesine bağlı üründe sitenin zengin verisi (özet, specs, öne çıkanlar) da prompt'a girer.
  const siteSource = websiteBriefSource(product);

  const prompt = [
    `ÜRÜN: ${m.name_tr || product.name_en} (EN: ${product.name_en})`,
    `Kategori: ${product.category}`,
    specLines ? `Teknik özellikler:\n${specLines}` : '',
    m.highlights?.length ? `Mevcut highlights: ${m.highlights.join(', ')}` : '',
    m.audience ? `Hedef kitle: ${m.audience}` : '',
    m.promise ? `Ürün vaadi: ${m.promise}` : '',
    siteSource ? `\n--- Web Sitesi Ürün Verisi (processturk.com) ---\n${siteSource.slice(0, 8000)}` : '',
    kbExcerpt ? `\n--- İlgili Şirket Bilgisi ---\n${kbExcerpt.slice(0, 800)}` : '',
    `\nŞu JSON şeklini döndür:\n${schema}`,
  ].filter(Boolean).join('\n');

  return callGPT(system, prompt);
}

async function main() {
  const products = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf8'));
  ensureDir(BRIEFS_DIR);

  let kbExcerpt = '';
  try {
    const kb = fs.readFileSync(KB_PATH, 'utf8');
    kbExcerpt = kb.slice(0, 3000);
  } catch {
    console.warn('⚠ Knowledge base okunamadı — brief\'ler ürün verisinden üretilecek.');
  }

  let generated = 0, skipped = 0;

  for (const product of products) {
    const briefPath = path.join(BRIEFS_DIR, `${product.slug}.json`);
    const existing = fs.existsSync(briefPath) ? JSON.parse(fs.readFileSync(briefPath, 'utf8')) : null;

    if (existing?.approved && !FORCE) {
      console.log(`⏭  ${product.slug} — onaylı brief var, atlanıyor (--force ile üzerine yaz)`);
      skipped++;
      continue;
    }

    process.stdout.write(`⚙  ${product.slug} — üretiliyor…`);
    try {
      const parsed = await generateBrief(product, kbExcerpt);
      const brief = {
        slug: product.slug,
        approved: false,
        highlights: parsed.highlights || [],
        target_industries: parsed.target_industries || [],
        ideal_customer: parsed.ideal_customer || '',
        pain_points: parsed.pain_points || [],
        dont_say: parsed.dont_say || ['Avrupa teknolojisi', 'İthal parça', 'En ucuz'],
        image_notes: parsed.image_notes || '',
        last_updated: new Date().toISOString(),
        _generated_by: 'generate_briefs.js / gpt-4o',
      };
      fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2));
      console.log(' ✓');
      generated++;
      // Rate limit için kısa bekleme
      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      console.error(` ⛔ HATA: ${e.message}`);
    }
  }

  console.log(`\n✅ Tamamlandı: ${generated} üretildi, ${skipped} atlandı.`);
  console.log('Panelden http://localhost:4181/urun/<slug> → "Brief" sekmesinden inceleyip onaylayın.');
}

main().catch((e) => { console.error(e); process.exit(1); });
