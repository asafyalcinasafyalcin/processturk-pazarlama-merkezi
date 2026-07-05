// İçerik şablonları — her şablon bir görsel/video üretim stratejisi tanımlar.
// 4 şablon: makine-vitrin, muhendis-anlatim, kisa-video, maskot-konsept.
// Marka rengi (navy) ve maskot tanımı brand.js'ten (BRAND_ID yoksa ProcessTürk varsayılanı).
import { BRAND } from './brand.js';

export const TEMPLATES = [
  {
    id: 'makine-vitrin',
    label: 'Makine Vitrin',
    emoji: '🏭',
    desc: 'Ürün lifestyle sahnesi — makinenin profesyonel stüdyo çekimi.',
    type: 'image',
    requiresSoulId: false,
    estimatedCost: '$0.02',
    buildPrompt(product, lang) {
      const m = product.marketing || {};
      const name = m.name_tr || product.name_en;
      const cat = product.category || 'industrial machine';
      const filled = product.specs?.filled_products;
      return [
        `Premium product photography of the ${product.name_en}, a ${cat} machine made of 304 stainless steel.`,
        'Situated in a clean, modern food production facility. Soft cinematic key lighting from the left.',
        `Deep navy blue background gradient (${BRAND.navy}). Machine is the hero, centered and sharp.`,
        filled ? `The machine is used for processing: ${filled}.` : '',
        'No text, no logos, no watermarks, no people. Photorealistic, commercial advertising quality. 4K detail.',
      ].filter(Boolean).join(' ');
    },
    buildNegativePrompt() {
      return 'text, letters, numbers, watermark, logo, brand name, people, hands, ugly, blurry, low quality, cartoon';
    },
  },
  {
    id: 'muhendis-anlatim',
    label: 'Mühendis Anlatım',
    emoji: '👷',
    desc: 'Deneyimli bir satış mühendisi makineyi gösteriyor / açıklıyor.',
    type: 'image',
    requiresSoulId: false,
    estimatedCost: '$0.03',
    buildPrompt(product, lang) {
      const name = product.name_en;
      const cat = product.category || 'industrial machine';
      return [
        `Professional Turkish male sales engineer, 35-40 years old, wearing navy blue work uniform and white safety helmet.`,
        `He is standing next to and gesturing toward a ${name} (${cat}) stainless steel industrial machine.`,
        'Confident, warm smile. Clean factory environment background. Soft professional lighting.',
        'Photorealistic portrait. The machine is clearly visible behind/beside him.',
        'No text, no logos, no watermarks. Commercial advertising quality.',
      ].filter(Boolean).join(' ');
    },
    buildNegativePrompt() {
      return 'text, letters, numbers, watermark, logo, ugly, blurry, low quality, cartoon, anime, deformed hands, extra fingers';
    },
  },
  {
    id: 'kisa-video',
    label: 'Kısa Video',
    emoji: '🎬',
    desc: '10 saniye dinamik tanıtım videosu — düşük maliyetli versiyon.',
    type: 'video',
    requiresSoulId: false,
    estimatedCost: '~$0.15',
    buildPrompt(product, lang) {
      return [
        `Cinematic close-up of the ${product.name_en} in action: smooth automated motion, product flowing/filling,`,
        'stainless steel surfaces gleaming. Subtle slow camera push-in. Premium commercial mood.',
        'Vertical 9:16 composition. No text, no watermarks. The machine is the hero.',
      ].join(' ');
    },
    buildNegativePrompt() {
      return 'text, letters, numbers, watermark, logo, brand name, control panel text, ugly, blurry';
    },
  },
  {
    id: 'maskot-konsept',
    label: 'Maskot',
    emoji: '🦸',
    desc: `${BRAND.name} robotu makineyi tanıtıyor. Soul ID hazırsa daha tutarlı.`,
    type: 'image',
    requiresSoulId: true,
    estimatedCost: '$0.05',
    buildPrompt(product, lang) {
      const name = product.name_en;
      return [
        `${BRAND.mascotDesc} — standing next to a ${name} industrial machine.`,
        'The robot is cheerfully presenting the machine with an enthusiastic pointing gesture.',
        'Clean modern industrial facility background. Soft cinematic lighting. Deep navy blue color scheme.',
        'Photorealistic 3D character, commercial advertising quality. No text, no watermarks.',
      ].join(' ');
    },
    buildNegativePrompt() {
      return 'text, letters, numbers, watermark, logo, ugly, blurry, low quality';
    },
  },
];

export function findTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
}
