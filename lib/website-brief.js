// Web sitesi ürün bloğunu (products.json → website, website-sync yazar) brief/metin
// üretimi için okunabilir kaynak metne çevirir. Saf fonksiyon — client bileşeni,
// API route ve CLI (generate_briefs.js) aynı fonksiyonu kullanır.
// KURAL: fiyat bilgisi bilerek DAHİL EDİLMEZ (brief'lerde fiyat yazılmaz).

function t(v, lang = 'tr') {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v[lang] || v.tr || v.en || Object.values(v)[0] || '';
}

const AUTOMATION_TR = { manuel: 'manuel', yari: 'yarı otomatik', tam: 'tam otomatik' };

// [{k:i18n, v:i18n}] listesini "  · k: v" satırlarına çevirir (SSS, akış, gereksinim).
function kvLines(list, lang = 'tr', limit = 12) {
  return (list || [])
    .slice(0, limit)
    .map((row) => {
      const k = t(row?.k, lang);
      const v = t(row?.v, lang);
      return k && v ? `  · ${k}: ${v}` : '';
    })
    .filter(Boolean);
}

// [i18n] listesini düz maddelere çevirir.
function itemLines(list, lang = 'tr', limit = 12) {
  return (list || []).map((x) => t(x, lang)).filter(Boolean).slice(0, limit).map((x) => `  · ${x}`);
}

export function websiteBriefSource(product) {
  const w = product?.website;
  if (!w) return '';
  const c = w.content || {};
  const lines = [];
  lines.push(`WEB SİTESİ ÜRÜN VERİSİ (${w.type === 'line' ? 'anahtar teslim üretim hattı' : 'makine'})`);

  const nameTr = t(w.name, 'tr');
  const nameEn = t(w.name, 'en');
  if (nameTr) lines.push(`Ürün adı: ${nameTr}${nameEn && nameEn !== nameTr ? ` (EN: ${nameEn})` : ''}`);
  if (w.category) lines.push(`Ürün grubu: ${t(w.category.name, 'tr')}`);

  const sumTr = t(w.summary, 'tr');
  const sumEn = t(w.summary, 'en');
  if (sumTr) lines.push(`Özet: ${sumTr}`);
  if (sumEn && sumEn !== sumTr) lines.push(`Özet (EN): ${sumEn}`);

  const desc = t(c.description, 'tr');
  if (desc) lines.push(`Detay açıklaması (site metni):\n${desc}`);

  if (w.capacity) lines.push(`Kapasite: ${w.capacity}`);
  if (w.deliveryWeeks) lines.push(`Teslim süresi: ${w.deliveryWeeks}`);
  if (w.automation) lines.push(`Otomasyon: ${AUTOMATION_TR[w.automation] || w.automation}`);
  if (w.material) lines.push(`Malzeme: ${w.material}`);
  if (w.badge) lines.push(`Site rozeti: ${t(w.badge, 'tr')}`);

  const specs = kvLines(w.specs, 'tr', 16);
  if (specs.length) lines.push('Teknik özellikler:', ...specs);

  const highlights = (w.highlights || []).map((h) => t(h, 'tr')).filter(Boolean);
  if (highlights.length) lines.push('Sitedeki öne çıkanlar / ana sistemler:', ...highlights.map((h) => `  · ${h}`));

  // ── Detay sayfası zengin içeriği (feed → content bloğu) ──
  const audience = itemLines(c.audience, 'tr', 8);
  if (audience.length) lines.push('Kimler için uygun (site):', ...audience);

  const capOpts = (c.capacityOptions || []).filter(Boolean).slice(0, 8);
  if (capOpts.length) lines.push(`Kapasite seçenekleri: ${capOpts.join(' · ')}`);

  const packaging = itemLines(c.packagingOptions, 'tr', 10);
  if (packaging.length) lines.push('Ambalaj / proses seçenekleri:', ...packaging);

  const optFeat = itemLines(c.optionalFeatures, 'tr', 10);
  if (optFeat.length) lines.push('Opsiyonel özellikler:', ...optFeat);

  const fitNote = t(c.fitNote, 'tr');
  if (fitNote) lines.push(`Ürüne göre özelleştirme notu: ${fitNote}`);

  const flow = kvLines(c.processFlow, 'tr', 12);
  if (flow.length) lines.push('Üretim akışı adımları:', ...flow);

  const reqs = kvLines(c.requirements, 'tr', 10);
  if (reqs.length) lines.push('Tesis gereksinimleri (alan/güç/personel):', ...reqs);

  const optEq = itemLines(c.optionalEq, 'tr', 10);
  if (optEq.length) lines.push('Opsiyonel ekipmanlar:', ...optEq);

  const rationale = t(c.rationale, 'tr');
  if (rationale) lines.push(`Yatırım mantığı (site metni):\n${rationale}`);

  const faq = kvLines(c.faq, 'tr', 10);
  if (faq.length) lines.push('Sitedeki SSS:', ...faq);

  if (w.url) lines.push(`Site sayfası: ${w.url}`);
  return lines.join('\n');
}

// Hedef dildeki RESMİ site çevirisi (ad + özet + kilit specs) — çok dilli reklam kopyası
// bu onaylı çeviriyi temel alsın diye buildCopyPrompt'a geçilir. Dilde veri yoksa '' döner.
export function websiteLangSnippet(product, lang) {
  const w = product?.website;
  if (!w) return '';
  const c = w.content || {};
  const name = w.name?.[lang];
  const summary = w.summary?.[lang];
  const category = w.category?.name?.[lang];
  if (!name && !summary) return ''; // bu dilde onaylı çeviri yoksa modele dayatma

  const lines = [];
  if (name) lines.push(`Ürün adı (resmi çeviri): ${name}`);
  if (category) lines.push(`Ürün grubu: ${category}`);
  if (summary) lines.push(`Ürün özeti (resmi çeviri): ${summary}`);
  const desc = c.description?.[lang];
  if (desc) lines.push(`Ürün açıklaması (resmi çeviri): ${String(desc).slice(0, 600)}`);
  const specs = (w.specs || [])
    .map((row) => {
      const k = row?.k?.[lang];
      const v = row?.v?.[lang];
      return k && v ? `${k}: ${v}` : '';
    })
    .filter(Boolean)
    .slice(0, 6);
  if (specs.length) lines.push('Teknik özellikler: ' + specs.join(' · '));
  const hl = (w.highlights || []).map((h) => h?.[lang]).filter(Boolean).slice(0, 5);
  if (hl.length) lines.push('Öne çıkanlar (resmi çeviri): ' + hl.join(' · '));
  return lines.join('\n');
}

// ── Deterministik siteden-brief: LLM YOK, %100 site verisi ─────────────────────
// "Hayal görmesin" garantisi: brief alanları doğrudan sitenin kendi metinlerinden
// derlenir. LLM yalnız istenirse (rafine modu) üstüne geçer; bu taban her zaman gerçektir.
export function buildWebsiteBrief(product) {
  const w = product?.website;
  if (!w) return null;
  const c = w.content || {};

  // Öne çıkanlar: sitenin highlights'ı + kapasite/teslim gibi somut gerçekler.
  const highlights = (w.highlights || []).map((h) => t(h, 'tr')).filter(Boolean).slice(0, 5);
  if (w.capacity && highlights.length < 5) highlights.push(`Kapasite: ${w.capacity}`);
  if (w.deliveryWeeks && highlights.length < 5) highlights.push(`Teslim süresi: ${w.deliveryWeeks}`);
  if (w.material && highlights.length < 5) highlights.push(`${w.material} paslanmaz gövde`);

  // Hedef sektörler: sitenin "kimler için uygun" + uygun ürünler alanları.
  const industries = [
    ...(c.audience || []).map((x) => t(x, 'tr')),
  ].filter(Boolean).slice(0, 4);

  const summary = t(w.summary, 'tr');
  const category = t(w.category?.name, 'tr');

  return {
    slug: product.slug,
    approved: false,
    highlights,
    target_industries: industries,
    ideal_customer: industries.length
      ? `${industries[0]} — ${category || (w.type === 'line' ? 'anahtar teslim üretim hattı' : 'makine')} yatırımı planlayan işletme`
      : summary,
    pain_points: [],
    dont_say: ['Avrupa teknolojisi', 'İthal parça', 'En ucuz', 'fiyat/rakam'],
    image_notes: [w.material, category, w.type === 'line' ? 'komple üretim hattı, tesis ortamı' : 'endüstriyel makine, üretim tesisi ortamı']
      .filter(Boolean).join(' · '),
    website_source: w.url || '',
    last_updated: new Date().toISOString(),
    _generated_by: 'website-brief (deterministik, site verisi)',
  };
}
