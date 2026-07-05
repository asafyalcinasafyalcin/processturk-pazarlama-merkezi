// Bu liste CLIENT component'lerinden (UrunDetay) import edilir → server-only brand.js
// (node:fs) buraya GİREMEZ. Maskot açıklaması marka-nötr; marka adı gerekiyorsa UI prop'la gelir.
export const IMAGE_CONCEPTS = [
  {
    id: 'vitrin',
    label: 'Vitrin',
    emoji: '🏭',
    templateId: 'makine-vitrin',
    desc: 'Beyaz/gri arka plan, ürün merkezde, stüdyo ışığı',
  },
  {
    id: 'muhendis',
    label: 'Mühendis',
    emoji: '👷',
    templateId: 'muhendis-anlatim',
    desc: 'Fabrika ortamı, operatör makineyi çalıştırıyor',
  },
  {
    id: 'ihracat',
    label: 'İhracat',
    emoji: '🚢',
    templateId: 'makine-vitrin',
    desc: 'Liman/depo arka planı, uluslararası atmosfer',
    promptSuffix: 'International port warehouse background, global export atmosphere, containers.',
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle',
    emoji: '✨',
    templateId: 'makine-vitrin',
    desc: 'Ürün çıktısı (gıda/paket) ön planda, makine arka',
    promptSuffix: 'Product output in foreground (filled packages, food), machine visible in background, lifestyle feel.',
  },
  {
    id: 'maskot',
    label: 'Maskot',
    emoji: '🤖',
    templateId: 'maskot-konsept',
    desc: 'Marka maskotu/robotu makineyi gösteriyor (Soul ID)',
    requiresSoulId: true,
  },
  {
    id: 'ozel',
    label: 'Özel',
    emoji: '✏️',
    templateId: null,
    desc: 'Kendi notunu yaz',
    isCustom: true,
  },
];
