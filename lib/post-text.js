// Platform-spesifik sosyal medya metni + hashtag üretimi.
// Marka sesi: profesyonel, çözüm odaklı, mühendislik güveni.
// Her platform için ayrı ton, karakter limiti, hashtag sayısı.
// Marka adı + hashtag havuzu brand.js'ten (BRAND_ID yoksa ProcessTürk varsayılanı).
import { genStructured } from './providers/gen.js';
import { LANG_NAMES, CTA_BY_LANG, BRAND } from './brand.js';
import { readBrief } from './brief.js';

const PLATFORM_RULES = {
  instagram: {
    label: 'Instagram',
    maxChars: 2200,
    hashtagCount: '15-20',
    tone: 'Samimi, ilham verici, emoji kullan (3-6 arası). Hikaye anlat. Soruyla bitir veya CTA ekle.',
    format: 'Kısa hook (1-2 cümle) → fayda (2-3 cümle) → CTA → hashtag (ayrı satırda)',
  },
  linkedin: {
    label: 'LinkedIn',
    maxChars: 3000,
    hashtagCount: '3-5',
    tone: 'Profesyonel ama sıcak. Endüstriyel uzmanlık vurgula. Emoji çok az (0-2). İş dünyasına hitap.',
    format: 'Hook cümle → problem/çözüm (2-4 cümle) → somut fayda → CTA → hashtag',
  },
  x: {
    label: 'X (Twitter)',
    maxChars: 280,
    hashtagCount: '2-3',
    tone: 'Kısa, keskin, dikkat çekici. Tek güçlü mesaj. Emoji 1-2 tane.',
    format: 'Hook (1 cümle) + fayda (1 cümle) + hashtag. TOPLAM 280 karakter MAX.',
  },
};

// Sosyal medya içerik açıları (konsept) — kullanıcı seçer, ton/odak değişir.
export const SOCIAL_CONCEPTS = [
  { id: 'tanitim',   label: '📢 Tanıtım',        angle: 'Ürünün ne olduğunu ve temel faydasını net anlat. Klasik tanıtım.' },
  { id: 'sorun',     label: '🔧 Sorun-Çözüm',    angle: 'Müşterinin yaşadığı somut bir sorunla başla, ürünü çözüm olarak sun.' },
  { id: 'sosyal',    label: '⭐ Güven/Referans',  angle: 'Türk mühendisliği, dayanıklılık, ihracat güveni ve referans hissi ver.' },
  { id: 'egitim',    label: '💡 Eğitici',        angle: 'Sektöre dair bir ipucu/bilgi ver, ürünü doğal şekilde bağla. Değer odaklı.' },
  { id: 'aciliyet',  label: '🔥 Harekete Geçir', angle: 'Enerjik, doğrudan, güçlü CTA. Hemen iletişime geçmeye teşvik et.' },
  { id: 'sahne',     label: '🏭 Sahne Arkası',    angle: 'Üretim/atölye atmosferi, makinenin iş başında olduğu hissi.' },
];

export function findSocialConcept(id) {
  return SOCIAL_CONCEPTS.find((c) => c.id === id) || SOCIAL_CONCEPTS[0];
}

// Hashtag havuzu marka kaydından gelir (brand.js → _core/brands/<BRAND_ID>.json ·
// marketing.hashtags). Kayıt vermezse jenerik marka-nötr havuza düşer (koda marka
// gömülmez). Marka etiketi #<Marka> otomatik önek olarak eklenir.
const GENERIC_HASHTAGS = {
  tr: '#üretim #otomasyon #makine #sanayi #ihracat',
  en: '#manufacturing #automation #machinery #industry #export',
  ar: '#تصنيع #أتمتة #صناعة',
  fr: '#fabrication #automatisation #industrie',
  ru: '#производство #автоматизация #промышленность',
};
const _brandTag = `#${String(BRAND.name).replace(/\s+/g, '')}`;
const HASHTAG_POOL = BRAND.hashtags
  || Object.fromEntries(Object.entries(GENERIC_HASHTAGS).map(([k, v]) => [k, `${_brandTag} ${v}`]));

function buildSystem(platform, lang, concept) {
  const langName = LANG_NAMES[lang] || lang;
  const rules = PLATFORM_RULES[platform] || PLATFORM_RULES.instagram;
  const cta = CTA_BY_LANG[lang] || CTA_BY_LANG.en;
  const pool = HASHTAG_POOL[lang] || HASHTAG_POOL.en;
  const c = findSocialConcept(concept);

  return [
    `Sen ${BRAND.promptName} için ${rules.label} sosyal medya metni yazan uzman bir içerik yazarısın.`,
    `Marka sesi: profesyonel, çözüm odaklı, mühendislik güveni. Ucuz satış dili YOK.`,
    `İçerik açısı: ${c.angle}`,
    `Platform: ${rules.label}. Ton: ${rules.tone}`,
    `Format: ${rules.format}`,
    `OKUNABİLİRLİK KURALI (ÇOK ÖNEMLİ): caption'ı paragraflara böl. Her fikir/bölüm arasında BOŞ SATIR bırak (\\n\\n). Tek tıkışık blok ASLA yazma. Kısa cümleler kullan. Gerekirse madde işareti (•) kullan.`,
    `Maksimum karakter: ${rules.maxChars}. Hashtag sayısı: ${rules.hashtagCount}.`,
    `KURAL: FİYAT YOK — hiçbir metinde fiyat/para birimi geçmesin.`,
    `KURAL: "Avrupa menşeli/ithal" YASAK. Yalnızca "Türk mühendisliği / Türkiye'de üretim" kullan.`,
    `CTA örneği: "${cta}"`,
    `Hashtag havuzu (bunları kullan/uyarla): ${pool}`,
    `Çıktı dili: ${langName} (metin TAMAMEN bu dilde olmalı). SADECE tek satır minified JSON döndür; markdown/yorum YOK.`,
    `JSON şeması: {"caption":"...platform metni (paragraflar \\n\\n ile ayrılmış)...","hashtags":["#tag1","#tag2",...]}`,
  ].join(' ');
}

// LLM bazen paragrafları tek satıra sıkıştırır → okunabilirlik için boş satırları garanti et.
function ensureSpacing(caption) {
  if (!caption) return caption;
  let t = caption.replace(/\r\n/g, '\n').trim();
  // Zaten boş satır varsa dokunma
  if (/\n\s*\n/.test(t)) return t;
  // Tek \n'leri çift \n yap (paragraf hissi)
  if (t.includes('\n')) return t.replace(/\n/g, '\n\n');
  // Hiç satır sonu yoksa: cümle sonlarından böl (2-3 cümlede bir boş satır)
  const sentences = t.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (sentences && sentences.length > 2) {
    const out = [];
    for (let i = 0; i < sentences.length; i += 2) {
      out.push(sentences.slice(i, i + 2).join('').trim());
    }
    return out.join('\n\n');
  }
  return t;
}

function buildPrompt(product, platform, lang, templateId) {
  const m = product.marketing || {};
  const name = m.name_tr || product.name_en;
  // Brief öncelikli — Asaf'ın onayladığı özellik listesi
  const brief = readBrief(product.slug);
  const highlightArr = brief?.highlights?.length
    ? brief.highlights
    : (m.highlights?.length ? m.highlights : [product.specs?.capacity].filter(Boolean));
  const highlights = highlightArr.join(', ');
  const dontSay = brief?.dont_say?.length ? `Kesinlikle söyleme: ${brief.dont_say.join(', ')}.` : '';
  const idealCustomer = brief?.ideal_customer || m.audience || '';
  const templateCtx = {
    'makine-vitrin': 'profesyonel ürün fotoğrafı paylaşımı için',
    'muhendis-anlatim': 'mühendis ve makine tanıtım görseli için',
    'kisa-video': 'kısa tanıtım videosu için',
    'maskot-konsept': 'maskot karakterinin makine tanıtımı için',
  };

  return [
    `Ürün: ${name} (EN: ${product.name_en})`,
    `Kategori: ${product.category}`,
    highlights ? `Öne çıkan özellikler (bunları vurgula): ${highlights}` : '',
    idealCustomer ? `Hedef müşteri: ${idealCustomer}` : '',
    m.promise ? `Değer vaadi: ${m.promise}` : '',
    product.specs?.capacity ? `Kapasite: ${product.specs.capacity}` : '',
    dontSay,
    `İçerik bağlamı: Bu bir ${templateCtx[templateId] || 'ürün tanıtımı'} sosyal medya postu.`,
    `Platform için ${PLATFORM_RULES[platform]?.label || platform} metnini yaz.`,
  ].filter(Boolean).join('\n');
}

export async function generatePostText({ product, platforms, lang = 'tr', templateId = 'makine-vitrin', concept = 'tanitim' }) {
  const results = {};

  // Her platform için ayrı LLM çağrısı (ton farklı)
  await Promise.all(
    platforms.map(async (platform) => {
      const key = platform in PLATFORM_RULES ? platform : 'instagram';
      try {
        const data = await genStructured({
          system: buildSystem(key, lang, concept),
          prompt: buildPrompt(product, key, lang, templateId),
        });
        if (data?.caption) {
          results[platform] = {
            caption: ensureSpacing(data.caption),
            hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
          };
        } else {
          results[platform] = { caption: '', hashtags: [], error: 'LLM boş yanıt döndü' };
        }
      } catch (e) {
        results[platform] = { caption: '', hashtags: [], error: e.message };
      }
    })
  );

  return results;
}

export { PLATFORM_RULES };
