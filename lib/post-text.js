// Platform-spesifik sosyal medya metni + hashtag üretimi.
// ProcessTürk marka sesi: profesyonel, çözüm odaklı, mühendislik güveni.
// Her platform için ayrı ton, karakter limiti, hashtag sayısı.
import { genStructured } from './providers/gen.js';
import { LANG_NAMES, CTA_BY_LANG } from './brand.js';

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

const HASHTAG_POOL = {
  tr: '#ProcessTürk #dolummakinesi #ambalajmakinesi #gıdamakineleri #üretim #otomasyon #paslanmazçelik #gıdasektörü #makineimalat #TürkMühendisliği #endüstriyelmakine #üretimhattı',
  en: '#ProcessTurk #fillingmachine #packagingmachine #foodmachinery #industrialmachine #automation #stainlesssteel #foodindustry #manufacturing #TurkishEngineering #production',
  ar: '#ProcessTurk #ماكينة_تعبئة #ماكينات_غذائية #أتمتة #تصنيع #الصناعة_الغذائية',
  fr: '#ProcessTurk #machineremplissage #industriealimentaire #automatisation #fabrication #acierinoxydable',
  ru: '#ProcessTurk #упаковочноеоборудование #пищевоепроизводство #автоматизация #промышленность',
};

function buildSystem(platform, lang) {
  const langName = LANG_NAMES[lang] || lang;
  const rules = PLATFORM_RULES[platform] || PLATFORM_RULES.instagram;
  const cta = CTA_BY_LANG[lang] || CTA_BY_LANG.en;
  const pool = HASHTAG_POOL[lang] || HASHTAG_POOL.en;

  return [
    `Sen ProcessTürk için ${rules.label} sosyal medya metni yazan uzman bir içerik yazarısın.`,
    `Marka sesi: profesyonel, çözüm odaklı, mühendislik güveni. Ucuz satış dili YOK.`,
    `Platform: ${rules.label}. Ton: ${rules.tone}`,
    `Format: ${rules.format}`,
    `Maksimum karakter: ${rules.maxChars}. Hashtag sayısı: ${rules.hashtagCount}.`,
    `KURAL: FİYAT YOK — hiçbir metinde fiyat/para birimi geçmesin.`,
    `KURAL: "Avrupa menşeli/ithal" YASAK. Yalnızca "Türk mühendisliği / Türkiye'de üretim" kullan.`,
    `CTA örneği: "${cta}"`,
    `Hashtag havuzu (bunları kullan/uyarla): ${pool}`,
    `Çıktı dili: ${langName}. SADECE tek satır minified JSON döndür; markdown/yorum YOK.`,
    `JSON şeması: {"caption":"...platform metni...","hashtags":["#tag1","#tag2",...]}`,
  ].join(' ');
}

function buildPrompt(product, platform, lang, templateId) {
  const m = product.marketing || {};
  const name = m.name_tr || product.name_en;
  const highlights = m.highlights?.join(', ') || product.specs?.capacity || '';
  const templateCtx = {
    'makine-vitrin': 'profesyonel ürün fotoğrafı paylaşımı için',
    'muhendis-anlatim': 'mühendis ve makine tanıtım görseli için',
    'kisa-video': 'kısa tanıtım videosu için',
    'maskot-konsept': 'maskot karakterinin makine tanıtımı için',
  };

  return [
    `Ürün: ${name} (EN: ${product.name_en})`,
    `Kategori: ${product.category}`,
    highlights ? `Öne çıkan özellikler: ${highlights}` : '',
    m.promise ? `Vaat: ${m.promise}` : '',
    product.specs?.capacity ? `Kapasite: ${product.specs.capacity}` : '',
    `İçerik bağlamı: Bu bir ${templateCtx[templateId] || 'ürün tanıtımı'} sosyal medya postu.`,
    `Platform için ${PLATFORM_RULES[platform]?.label || platform} metnini yaz.`,
  ].filter(Boolean).join('\n');
}

export async function generatePostText({ product, platforms, lang = 'tr', templateId = 'makine-vitrin' }) {
  const results = {};

  // Her platform için ayrı LLM çağrısı (ton farklı)
  await Promise.all(
    platforms.map(async (platform) => {
      const key = platform in PLATFORM_RULES ? platform : 'instagram';
      try {
        const data = await genStructured({
          system: buildSystem(key, lang),
          prompt: buildPrompt(product, key, lang, templateId),
        });
        if (data?.caption) {
          results[platform] = {
            caption: data.caption,
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
