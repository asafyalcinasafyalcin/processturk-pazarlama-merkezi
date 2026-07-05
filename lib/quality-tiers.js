// ─────────────────────────────────────────────────────────────────────────────
// KALİTE TIER MOTORU — Asaf'ın ANA şikayeti: sabit ucuz-tier → seçilebilir kalite.
// ─────────────────────────────────────────────────────────────────────────────
// Karar (Asaf, 2026-07-04): economy | standard | premium — VARSAYILAN = premium.
//   Görsel premium = en kaliteli tanımlı model (fal flux-pro / nano-banana-pro,
//     HF nano_banana_2_pro / cinematic_studio_image); hepsi UI'dan seçilebilir.
//   Video premium = en kaliteli (fal kling-v3-pro / seedance-2 1080p+); seçilebilir.
//   1600px küçültme → parametre (varsayılan daha yüksek 2560; kaldırılabilir).
//
// Bu dosya SADECE eşleme/veri sağlar; para-harcatan güvenlikleri (credit-guard/PAUSED)
// hiç etkilemez. Bilinmeyen tier güvenli şekilde 'premium'a değil, GÖRÜNÜR uyarıyla
// çözülür (aşağıdaki resolveTier). Sessiz ucuza düşüş YOK.

export const DEFAULT_TIER = 'premium';
export const TIERS = ['economy', 'standard', 'premium'];

// ── GÖRSEL tier eşlemesi ─────────────────────────────────────────────────────
// Her tier hem fal hem HF için model id + çözünürlük/ölçek + kredi/maliyet etiketi taşır.
// UI bu tabloyu okuyup maliyet farkını gösterir (para-harcatan sistem şeffaflığı).
export const IMAGE_TIERS = {
  economy: {
    label: 'Ekonomi',
    desc: 'Hızlı taslak · en düşük maliyet',
    falModel: 'flux-schnell',      // fal-ai/flux/schnell
    hfModel: 'gpt_image_2',        // HF hızlı görsel
    maxLongEdge: 1600,             // hf_scene küçültme tavanı
    costLabel: '≈ düşük',
    costWeight: 1,
  },
  standard: {
    label: 'Standart',
    desc: 'Dengeli kalite/maliyet',
    falModel: 'flux-dev',          // fal-ai/flux/dev
    hfModel: 'flux_2',
    maxLongEdge: 2048,
    costLabel: '≈ orta',
    costWeight: 2,
  },
  premium: {
    label: 'Premium',
    desc: 'En yüksek kalite · varsayılan',
    falModel: 'flux-pro',          // fal-ai/flux-pro/v1.1  (yoksa nano-banana-pro)
    falModelAlt: 'nano-banana-pro',
    hfModel: 'nano_banana_2_pro',  // HF referans/img2img premium; yoksa cinematic_studio_image
    hfModelAlt: 'cinematic_studio_image',
    maxLongEdge: 2560,             // premium'da küçültme darboğazı büyük ölçüde açılır
    costLabel: '≈ yüksek',
    costWeight: 5,
  },
};

// ── VIDEO tier eşlemesi ──────────────────────────────────────────────────────
export const VIDEO_TIERS = {
  economy: {
    label: 'Ekonomi',
    desc: 'Hızlı · en düşük maliyet · 720p',
    falModel: 'seedance-2-fast',
    hfModel: 'seedance_2_0',
    resolution: '720p',
    costLabel: '≈ düşük',
    costWeight: 1,
  },
  standard: {
    label: 'Standart',
    desc: 'Dengeli · 1080p',
    falModel: 'seedance-2',
    hfModel: 'seedance_2_0',
    resolution: '1080p',
    costLabel: '≈ orta',
    costWeight: 3,
  },
  premium: {
    label: 'Premium',
    desc: 'En yüksek kalite · 1080p+ · varsayılan',
    falModel: 'kling-v3-pro',      // fal premium (yoksa seedance-2 1080p)
    falModelAlt: 'seedance-2',
    hfModel: 'seedance_2_0',        // HF tek video motoru → 1080p ile premium
    resolution: '1080p',
    costLabel: '≈ yüksek',
    costWeight: 6,
  },
};

// Geçersiz/eksik tier → GÖRÜNÜR düzeltme (sessiz ucuza kaçış YOK).
// Bilinmeyen bir değer gelirse varsayılana (premium) döner ama `corrected` bayrağıyla
// çağıran uyarabilir. economy'ye ASLA sessizce düşmez.
export function resolveTier(tier) {
  if (tier && TIERS.includes(tier)) return { tier, corrected: false };
  return { tier: DEFAULT_TIER, corrected: Boolean(tier), requested: tier || null };
}

// Sağlayıcıya göre görsel model id'sini tier'dan çöz.
// provider: 'fal' | 'higgsfield'. Premium'da birincil model tanımlı; alt (fallback) da
// aynı tier içinde kalır — DÜŞÜK tier'a düşmez.
export function imageModelForTier(tier, provider = 'fal') {
  const t = IMAGE_TIERS[resolveTier(tier).tier];
  if (provider === 'higgsfield') return t.hfModel;
  return t.falModel;
}

export function videoModelForTier(tier, provider = 'fal') {
  const t = VIDEO_TIERS[resolveTier(tier).tier];
  if (provider === 'higgsfield') return t.hfModel;
  return t.falModel;
}

export function videoResolutionForTier(tier) {
  return VIDEO_TIERS[resolveTier(tier).tier].resolution;
}

export function imageMaxEdgeForTier(tier) {
  return IMAGE_TIERS[resolveTier(tier).tier].maxLongEdge;
}

// UI/onay diyaloğu için özet (maliyet farkı görünür).
export function tierSummary(kind = 'image') {
  const src = kind === 'video' ? VIDEO_TIERS : IMAGE_TIERS;
  return TIERS.map((id) => ({ id, ...src[id] }));
}
