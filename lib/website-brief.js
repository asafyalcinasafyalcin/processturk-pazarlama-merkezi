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

export function websiteBriefSource(product) {
  const w = product?.website;
  if (!w) return '';
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

  if (w.capacity) lines.push(`Kapasite: ${w.capacity}`);
  if (w.deliveryWeeks) lines.push(`Teslim süresi: ${w.deliveryWeeks}`);
  if (w.automation) lines.push(`Otomasyon: ${AUTOMATION_TR[w.automation] || w.automation}`);
  if (w.material) lines.push(`Malzeme: ${w.material}`);
  if (w.badge) lines.push(`Site rozeti: ${t(w.badge, 'tr')}`);

  const specs = (w.specs || [])
    .map((row) => {
      const k = t(row?.k, 'tr');
      const v = t(row?.v, 'tr');
      return k && v ? `  · ${k}: ${v}` : '';
    })
    .filter(Boolean);
  if (specs.length) lines.push('Teknik özellikler:', ...specs);

  const highlights = (w.highlights || []).map((h) => t(h, 'tr')).filter(Boolean);
  if (highlights.length) lines.push('Sitedeki öne çıkanlar / ana sistemler:', ...highlights.map((h) => `  · ${h}`));

  if (w.url) lines.push(`Site sayfası: ${w.url}`);
  return lines.join('\n');
}

// Hedef dildeki RESMİ site çevirisi (ad + özet + kilit specs) — çok dilli reklam kopyası
// bu onaylı çeviriyi temel alsın diye buildCopyPrompt'a geçilir. Dilde veri yoksa '' döner.
export function websiteLangSnippet(product, lang) {
  const w = product?.website;
  if (!w) return '';
  const name = w.name?.[lang];
  const summary = w.summary?.[lang];
  const category = w.category?.name?.[lang];
  if (!name && !summary) return ''; // bu dilde onaylı çeviri yoksa modele dayatma

  const lines = [];
  if (name) lines.push(`Ürün adı (resmi çeviri): ${name}`);
  if (category) lines.push(`Ürün grubu: ${category}`);
  if (summary) lines.push(`Ürün özeti (resmi çeviri): ${summary}`);
  const specs = (w.specs || [])
    .map((row) => {
      const k = row?.k?.[lang];
      const v = row?.v?.[lang];
      return k && v ? `${k}: ${v}` : '';
    })
    .filter(Boolean)
    .slice(0, 6);
  if (specs.length) lines.push('Teknik özellikler: ' + specs.join(' · '));
  return lines.join('\n');
}
