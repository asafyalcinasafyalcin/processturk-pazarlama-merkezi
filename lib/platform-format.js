// Platform → optimal görsel format mapping.
// Sadece seçili platformların formatları üretilir — gereksiz görsel üretilmez.

export const PLATFORM_FORMATS = {
  instagram:  { ratio: '4:5',  w: 1080, h: 1350, label: 'Feed (4:5)',   falSize: 'portrait_4_3' },
  instagram_story: { ratio: '9:16', w: 1080, h: 1920, label: 'Story (9:16)', falSize: 'portrait_16_9' },
  tiktok:     { ratio: '9:16', w: 1080, h: 1920, label: 'TikTok (9:16)', falSize: 'portrait_16_9' },
  youtube:    { ratio: '16:9', w: 1280, h: 720,  label: 'YouTube (16:9)', falSize: 'landscape_16_9' },
  linkedin:   { ratio: '1:1',  w: 1080, h: 1080, label: 'LinkedIn (1:1)', falSize: 'square' },
  x:          { ratio: '16:9', w: 1200, h: 675,  label: 'X / Twitter (16:9)', falSize: 'landscape_16_9' },
  facebook:   { ratio: '4:5',  w: 1080, h: 1350, label: 'Facebook (4:5)', falSize: 'portrait_4_3' },
};

// fal.ai image_size → HF aspect_ratio eşlemesi
export const FAL_TO_HF_RATIO = {
  portrait_4_3: '4:5',
  portrait_16_9: '9:16',
  landscape_16_9: '16:9',
  square: '1:1',
};

// Seçili platformlar listesinden en kapsayıcı formatı belirle.
// Öncelik: feed (4:5) > square (1:1) > story (9:16) > landscape (16:9)
export function resolveFormat(platforms = []) {
  if (!platforms.length) return PLATFORM_FORMATS.instagram;

  // Platform listesinden benzersiz format tiplerine bak
  const ratios = platforms.map((p) => PLATFORM_FORMATS[p]?.ratio || '4:5');

  // En çok kullanılan ratioyu seç (veya öncelik sırasına göre)
  const priority = ['4:5', '1:1', '9:16', '16:9'];
  for (const r of priority) {
    if (ratios.includes(r)) {
      const p = platforms.find((pl) => PLATFORM_FORMATS[pl]?.ratio === r);
      return PLATFORM_FORMATS[p] || PLATFORM_FORMATS.instagram;
    }
  }
  return PLATFORM_FORMATS.instagram;
}

// Belirtilen platform için görsel boyutunu döndür
export function getFormat(platform) {
  return PLATFORM_FORMATS[platform] || PLATFORM_FORMATS.instagram;
}

// Desteklenen tüm platformlar (UI için)
export const ALL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸', apiMode: 'meta' },
  { id: 'linkedin',  label: 'LinkedIn',  icon: '💼', apiMode: 'icerik-ajani' },
  { id: 'x',        label: 'X',         icon: '𝕏',  apiMode: 'icerik-ajani' },
  { id: 'tiktok',   label: 'TikTok',    icon: '🎵', apiMode: 'assisted' },
  { id: 'youtube',  label: 'YouTube',   icon: '▶️', apiMode: 'assisted' },
  { id: 'facebook', label: 'Facebook',  icon: '📘', apiMode: 'meta' },
];
