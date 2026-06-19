// ProcessTürk marka sabitleri + reklam içerik prompt kurucuları.
// Kaynak kurallar: Meta_Reklam_Sistemi/skills/{reklam-uretimi,tiktok-video}.md
// ve _core/brand-voice. Fiyat DAİMA products.json'dan gelir — uydurma yok.

export const BRAND = {
  navy: '#071739',          // panel teması
  red: '#FF3255',
  videoNavy: '#1A2B5F',     // video overlay (Asaf v2.1 kuralı)
  videoRed: '#D71920',
  whatsapp: process.env.WHATSAPP_NUMBER || '905527062723', // 0552 706 27 23 (mevcut hat)
  web: 'processturk.com',
  fonts: 'Montserrat (başlık), Inter (gövde), JetBrains Mono (rakam)',
};

// Güven bloğu (deterministik, doğru iddia) — küresel sevkiyat + 7/24 servis; menşe/bileşen iddiası YOK.
export const TRUST_BY_LANG = {
  tr: ["Türkiye'de üretim — Türk mühendisliği", 'Küresel sevkiyat · 7/24 uzaktan destek + servis ağı'],
  en: ['Made in Türkiye — Turkish engineering', 'Worldwide shipping · 24/7 remote support + service network'],
  fr: ['Fabriqué en Türkiye — ingénierie turque', 'Livraison mondiale · support à distance 24/7 + réseau de service'],
  ru: ['Произведено в Турции — турецкая инженерия', 'Доставка по миру · поддержка 24/7 + сервисная сеть'],
  ar: ['صناعة تركيا — هندسة تركية', 'شحن عالمي · دعم عن بُعد 24/7 + شبكة خدمة'],
};
export const TRUST_LINES = TRUST_BY_LANG.tr; // geriye dönük

// CTA — coğrafyaya/dile göre değer odaklı (B5)
export const CTA_BY_LANG = {
  tr: "Ülkenize sevkiyat ve fiyat için WhatsApp'tan yazın",
  en: 'Get a delivered price to your country — message us on WhatsApp',
  fr: 'Prix livré dans votre pays — écrivez-nous sur WhatsApp',
  ru: 'Цена с доставкой в вашу страну — напишите в WhatsApp',
  ar: 'سعر التوصيل إلى بلدك — راسلنا على واتساب',
};

export const TECH_TITLE_BY_LANG = { tr: 'TEKNİK ÖZELLİK', en: 'TECHNICAL SPEC', fr: 'CARACTÉRISTIQUE', ru: 'ТЕХ. ХАРАКТЕРИСТИКА', ar: 'المواصفات الفنية' };
export const CAPACITY_LABEL_BY_LANG = { tr: 'Kapasite', en: 'Capacity', fr: 'Capacité', ru: 'Производительность', ar: 'الطاقة' };
export const BODY_LABEL_BY_LANG = { tr: 'Gövde', en: 'Body', fr: 'Corps', ru: 'Корпус', ar: 'الهيكل' };

// Kanca tohumları (B2) — küresel sevkiyat + teknik servis yeteneğini öne çıkarır
export const HOOK_SEEDS_TR = [
  'Baharatı, kuruyemişi, granülü saatte 1.000 adede kadar doldurun — fireyi yarıya indirin.',
  'Dünyanın neresinde olursanız olun, makineniz orada: sevkiyat + kurulum + 7/24 destek dahil.',
  'Üretime bugün başlayın — biz kuralım, siz doldurun.',
];
export const RTL_LANGS = ['ar'];

export const LANG_NAMES = { tr: 'Türkçe', en: 'English', ar: 'العربية (Arabic)', fr: 'Français', ru: 'Русский (Russian)' };

function productLine(p) {
  const m = p.marketing || {};
  return [
    `Ürün: ${m.name_tr || p.name_en} (EN: ${p.name_en})`,
    `Kategori: ${p.category}`,
    `Fiyat: ${p.price_text || (p.price_usd ? p.price_usd + ' USD' : 'belirtilmemiş')}`,
    p.specs?.capacity ? `Kapasite: ${p.specs.capacity}` : null,
    p.specs?.filled_products ? `İşlenen ürünler: ${p.specs.filled_products}` : null,
    m.audience ? `Hedef kitle: ${m.audience}` : null,
    m.promise ? `Vaat: ${m.promise}` : null,
    m.hero_number ? `Öne çıkan rakam: ${m.hero_number}` : null,
  ].filter(Boolean).join('\n');
}

// ── Reklam/sosyal metni (copy v2) — TEK DİL, düz şema (güvenilir JSON), FİYATSIZ ──
export function buildCopyPrompt(p, lang = 'tr') {
  const langName = LANG_NAMES[lang] || lang;
  const system = [
    'Sen ProcessTürk için sosyal medya + reklam metni yazan kıdemli bir reklam yazarısın.',
    'Marka sesi: pozitif, çözüm odaklı, mühendislik güveni. Ucuz satış dili YOK.',
    'KURAL: FİYAT YOK — hiçbir metinde fiyat/para birimi geçmesin (kalıcı paylaşımlar, fiyat değişir).',
    'Kanca = teknik özellik/fark/sonuç (kapasite, paslanmaz çelik, hız, otomasyon, dayanıklılık). Harekete geçir.',
    'Teknik rakamları yalnızca verilen üründen al; asla uydurma.',
    'BİRİM DİSİPLİNİ: hız için tek format "adet/saat" (TR), binlik ayıracı nokta (1.000). "pcs", "pcs/hour", İngilizce/birimsiz YASAK.',
    'DOĞRU İDDİA: blanket "Avrupa menşeli/ithal" YASAK. Servis için yalnız "7/24 uzaktan destek + servis ağı" de (kesin "garantili servis" deme). "Türk mühendisliği / Türkiye\'de üretim" serbest.',
    `Çıktı dili: ${langName}. SADECE tek satır minified JSON döndür; markdown/yorum YOK. Metinlerde satır sonu KULLANMA.`,
  ].join(' ');

  // Düz şema (iç içe by_lang yok) → model güvenilir geçerli JSON üretir.
  const schema = '{"highlights":["2-4 kısa teknik özellik/fark"],"variants":[{"id":"A","angle":"ozellik","headline":"<=7 kelime fiyatsız","primary":"2-4 cümle kanca+fayda+WhatsApp daveti, fiyatsız","description":"<=1 satır güven sinyali","cta":"WhatsApp daveti"}]}';

  const prompt = [
    productLine(p),
    p.marketing?.highlights?.length ? `Öne çıkarılacak özellikler: ${p.marketing.highlights.join(', ')}` : null,
    '',
    'Görev: önce specs\'ten highlights öner, sonra 4 harekete geçirici varyant üret.',
    'Açılar (angle): A=ana özellik/fark, B=hız/kapasite, C=kalite/dayanıklılık, D=sorun-çözüm.',
    'Her varyant: headline (<=7 kelime, fiyatsız), primary (2-4 cümle, fiyatsız), description (<=1 satır), cta.',
    `WhatsApp CTA örnek (${langName}): "WhatsApp'tan bilgi al" / "Message us on WhatsApp".`,
    'Tam olarak şu JSON şeklini döndür (4 varyant A-D):',
    schema,
  ].filter(Boolean).join('\n');

  return { system, prompt };
}

// ── Görsel/video prompt'u (fal.ai) ──
// 9:16 dikey, mobil-öncelikli, gerçekçi endüstriyel ürün sahnesi.
export function buildImagePrompt(p) {
  const m = p.marketing || {};
  const subject = `${p.name_en}, industrial ${p.category} machine, stainless steel 304`;
  return [
    `Photorealistic product shot of a ${subject}, in a clean modern food-production facility.`,
    'Deep navy studio backdrop, soft cinematic key light, premium engineering look.',
    p.specs?.filled_products ? `Used for ${p.specs.filled_products}.` : '',
    'Vertical 9:16 composition, lots of clean negative space at top for a text overlay.',
    'No text, no logos, no watermarks in the image. Sharp, high detail, commercial advertising quality.',
  ].filter(Boolean).join(' ');
}

export function buildVideoPrompt(p) {
  return [
    `Cinematic close-up of the ${p.name_en} working: smooth automated motion, product flowing/filling, stainless steel surfaces gleaming.`,
    'Subtle camera push-in, factory bokeh background, premium commercial mood.',
    'Vertical 9:16. Clean, no text. The machine is the hero.',
  ].join(' ');
}

// Overlay metni (panelde gösterim) — FİYAT YOK (kalıcı paylaşım); özellik/kanca öne çıkar
export function overlayData(p, lang = 'tr') {
  const m = p.marketing || {};
  return {
    badge: /304/.test(p.name_en) ? '304 Paslanmaz' : '',
    title: lang === 'tr' ? (m.name_tr || p.name_en) : p.name_en,
    hero: (m.highlights && m.highlights[0]) || p.specs?.capacity || '',
    cta: lang === 'tr' ? "WhatsApp'tan bilgi al" : 'Message us on WhatsApp',
    whatsapp: BRAND.whatsapp,
  };
}
