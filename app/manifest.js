import { BRAND } from '@/lib/brand';

// PWA manifesti — marka-farkındalıklı (brand.js → _core/brands/<BRAND_ID>.json).
// BRAND_ID yoksa ProcessTürk varsayılanı. Next.js bunu /manifest.webmanifest olarak sunar.
export default function manifest() {
  return {
    name: `${BRAND.name} · Pazarlama Komuta Merkezi`,
    short_name: `${BRAND.name} Pazarlama`,
    description: BRAND.appDescription,
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4f6fb',
    theme_color: BRAND.navy,
    lang: 'tr',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
  };
}
