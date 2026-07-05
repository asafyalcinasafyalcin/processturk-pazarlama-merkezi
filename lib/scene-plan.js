import { genStructured } from './providers/gen.js';
import {
  LANG_NAMES, TRUST_BY_LANG, CTA_BY_LANG, TECH_TITLE_BY_LANG,
  CAPACITY_LABEL_BY_LANG, BODY_LABEL_BY_LANG, HOOK_SEEDS_TR, BRAND,
} from './brand.js';
import { formatCapacity, bodyMaterial } from './units.js';
import { readBrief } from './brief.js';

// v3 — çok dilli, 15-20 sn, 5 sahne. Kapasite/güven/teknik/CTA DETERMİNİSTİK
// (birim disiplini + doğru iddia + yerelleştirme garanti). LLM yalnız kanca + ikinci
// fayda + seslendirme üretir (hedef dilde). Sahneler: kanca(3) → ürün+fayda(6) →
// güven(4) → teknik kart(3) → CTA(4) ≈ 20 sn.

function cap1(s, lang) { return s ? s.charAt(0).toLocaleUpperCase(lang === 'tr' ? 'tr' : 'en') + s.slice(1) : s; }

export async function planAdScript({ product, lang = 'tr', highlights: _highlights = [] }) {
  // Brief öncelikli — Asaf'ın onayladığı özellik listesi
  const brief = readBrief(product.slug);
  const highlights = brief?.highlights?.length ? brief.highlights : (_highlights.length ? _highlights : []);
  const m = product.marketing || {};
  const langName = LANG_NAMES[lang] || lang;
  const cap = formatCapacity(product.specs?.capacity, lang);   // {value, labeled} | null
  const material = bodyMaterial(product, lang);
  const capLabeled = cap ? cap.labeled : (lang === 'tr' ? 'ürün tipine göre değişen kapasite' : 'capacity varies by product');
  const trust = TRUST_BY_LANG[lang] || TRUST_BY_LANG.tr;
  const ctaTitle = CTA_BY_LANG[lang] || CTA_BY_LANG.tr;

  const system = [
    `Sen ${BRAND.promptName} için endüstriyel makine tanıtım videosu senaryosu yazıyorsun. Çıktı dili: ${langName}.`,
    'Marka sesi: kendinden emin, sıcak, ENERJİK, çözüm odaklı (B2B). Donuk değil.',
    'FİYAT YOK. Sayılar birimli. DOĞRU İDDİA: "Avrupa menşeli/ithal" YASAK; servis = "7/24 uzaktan destek + servis ağı"; "Türk mühendisliği" + "küresel sevkiyat" serbest.',
    'Kanca güçlü olsun: küresel sevkiyat + kurulum + 7/24 destek yeteneğini ya da çarpıcı bir sonucu öne çıkar.',
    'SADECE tek satır minified JSON; markdown/satır sonu YOK.',
  ].join(' ');

  const schema = '{"hook":"çarpıcı tek cümle kanca, <=8 kelime","benefit_b":"ikinci fayda, <=5 kelime","voiceover":"15-20 sn akıcı tek paragraf; kapasiteyi VERİLEN ifadeyle söyle; hedef ürünleri (baharat, kuruyemiş, granül gıda) an; küresel sevkiyat + Türk mühendisliği + 7/24 uzaktan destek; fiyatsız; CTA ile bit"}';

  const prompt = [
    `ÜRÜN: ${m.name_tr || product.name_en} (EN: ${product.name_en}) · Kategori: ${product.category}`,
    `KAPASİTE (aynen kullan): ${capLabeled}`,
    material ? `Gövde: ${material}` : null,
    highlights?.length ? `Öne çıkan: ${highlights.join(', ')}` : null,
    m.audience ? `Hedef kitle: ${m.audience}` : null,
    lang === 'tr' ? `Kanca örnekleri (ilham): ${HOOK_SEEDS_TR.join(' | ')}` : null,
    '',
    'Şu JSON şeklini döndür:',
    schema,
  ].filter(Boolean).join('\n');

  const parsed = await genStructured({ system, prompt });
  const hook = parsed?.hook || (lang === 'tr' ? HOOK_SEEDS_TR[0] : 'Start production today — we build it, you fill it.');
  const benefitB = parsed?.benefit_b || (lang === 'tr' ? 'Hassas dozaj, daha az fire' : 'Precise dosing, less waste');
  const voiceover = parsed?.voiceover ||
    `${m.name_tr || product.name_en}: ${capLabeled}. ${trust[0]}. ${trust[1]}. ${ctaTitle}.`;

  // Deterministik kartlar (yerelleştirilmiş)
  const capLabel = CAPACITY_LABEL_BY_LANG[lang] || 'Kapasite';
  const bodyLabel = BODY_LABEL_BY_LANG[lang] || 'Gövde';
  const specLines = [`${capLabel}: ${capLabeled}`];
  if (material) specLines.push(`${bodyLabel}: ${material}`);

  const scenes = [
    { type: 'hook', durationSec: 3, caption: hook },
    { type: 'benefit', durationSec: 6, captionLines: [cap1(capLabeled, lang), benefitB] },
    { type: 'trust', durationSec: 4, lines: trust },
    { type: 'spec', durationSec: 3, title: TECH_TITLE_BY_LANG[lang] || 'TEKNİK ÖZELLİK', specLines },
    { type: 'cta', durationSec: 4, title: ctaTitle, whatsapp: BRAND.whatsapp, web: BRAND.web },
  ];

  return {
    lang, hook, benefitB, voiceover,
    cta: ctaTitle, specLines, trustLines: trust, capacity: capLabeled, material,
    scenes,
    totalSec: scenes.reduce((s, x) => s + x.durationSec, 0),
  };
}
