import { BRAND } from '@/lib/brand';

export const runtime = 'nodejs';

// Marka-farkındalıklı PWA/app ikonu (SVG) — navy zemin + kırmızı rozet + marka baş harfi.
// brand.js → _core/brands/<BRAND_ID>.json; BRAND_ID yoksa ProcessTürk varsayılanı.
export function GET() {
  const initial = String(BRAND.logoInitial || BRAND.name?.[0] || 'P').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${BRAND.navy}"/>
  <rect x="146" y="146" width="220" height="220" rx="52" fill="${BRAND.red}"/>
  <text x="256" y="256" dy="0.35em" text-anchor="middle" font-family="${BRAND.fontSans}, Arial, sans-serif" font-size="180" font-weight="800" fill="#ffffff">${initial}</text>
</svg>`;
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
