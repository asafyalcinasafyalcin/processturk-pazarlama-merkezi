import './globals.css';
import { Montserrat, Inter, JetBrains_Mono } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import PWARegister from '@/components/PWARegister';
import { BRAND } from '@/lib/brand';

// Fontlar next/font (build-time statik) — Inter gövde + mono ortak; başlık Montserrat.
// Sekme başlığı/açıklama + PWA manifesti marka kaydından (BRAND) — BRAND_ID yoksa
// ProcessTürk varsayılanı (canlı davranış korunur).
const montserrat = Montserrat({ subsets: ['latin'], weight: ['600', '700', '800', '900'], variable: '--font-head' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['600', '800'], variable: '--font-mono' });

export const metadata = {
  title: `${BRAND.name} · Pazarlama Komuta Merkezi`,
  description: 'Ürün onboarding, video/statik içerik üretimi ve sosyal medya & reklam yönetimi.',
  manifest: '/manifest.webmanifest',
  applicationName: `${BRAND.name} Pazarlama`,
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: `${BRAND.name} Pazarlama` },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

// PWA / mobil (375px) — marka rengi tema, kullanıcı zoom'una izin.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: BRAND.navy,
};

// ── White-label renk motoru ────────────────────────────────────────────────
// BRAND hex'ini Tailwind opacity-modifier'ının beklediği "R G B" kanal string'ine çevirir
// (bg-navy/5 → rgb(var(--navy-rgb)/0.05)). Ayrıca vurgu üzerindeki metni WCAG-güvenli seçer
// (altın gibi açık vurguda koyu metin; kırmızı/navy gibi koyuda beyaz) → R1 hesaplanmış CTA.
function hexToRgbChannels(hex) {
  const h = String(hex || '').replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6) || '000000', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixChannels(rgb, whitePct) {
  // rgb'yi beyazla karıştır (0..1) → türev navy tonları
  return rgb.map((c) => Math.round(c + (255 - c) * whitePct));
}
function relLuminance([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrastSafeText(rgb) {
  // Vurgu üzerindeki metin — R1 hesaplanmış CTA deseni: AÇIK vurguda (altın/sarı) koyu metin,
  // KOYU vurguda (kırmızı/navy) beyaz. Eşik luminance ~0.42 (orta-parlak kırmızı da beyaz kalsın;
  // salt kontrast oranı orta kırmızıda koyu metni seçerdi — marka tasarımı beyaz ister).
  // Ek güvence: beyaz metin bu vurguda WCAG AA'yı (≥3:1, büyük/kalın UI metni) sağlıyorsa beyaz.
  const L = relLuminance(rgb);
  const whiteContrast = 1.05 / (L + 0.05);
  if (L <= 0.42 && whiteContrast >= 2.6) return '#ffffff';
  return '#0B1220';
}
// WCAG kontrast oranı (iki rölatif luminans arası)
function contrastRatio(rgbA, rgbB) {
  const la = relLuminance(rgbA), lb = relLuminance(rgbB);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
// ── R4/G4 TUR-3: CTA ARKA PLANI, HERHANGİ BOYUT/AĞIRLIKTA AA-güvenli (≥4.5) ──
// Beyaz metin seçildiğinde (koyu vurgu) marka rengini gerektiği kadar KOYULAŞTIR —
// böylece text-xs (12px) buton bile beyaz metinle AA'yı sağlar. Marka rengi (--vurgu,
// rozet/border/overlay) DEĞİŞMEZ; yalnız buton/pill-active ARKA PLANI (--vurgu-btn) türetilir.
// Koyu-metin seçilen açık vurgular (altın) zaten AA-güvenli → aynen korunur.
function ctaBgHex(rgb) {
  const textIsWhite = contrastSafeText(rgb) === '#ffffff';
  const target = textIsWhite ? [255, 255, 255] : [11, 18, 32]; // #0B1220
  if (contrastRatio(rgb, target) >= 4.5) return null; // zaten güvenli → türetme yok
  if (!textIsWhite) return null; // koyu-metin açık vurgu (altın): dokunma
  // Beyaz metin AA'yı sağlayana kadar vurguyu siyaha doğru karıştır (en fazla %70).
  let out = rgb;
  for (let m = 0.05; m <= 0.7; m += 0.05) {
    out = rgb.map((c) => Math.round(c * (1 - m)));
    if (contrastRatio(out, [255, 255, 255]) >= 4.5) break;
  }
  return '#' + out.map((c) => c.toString(16).padStart(2, '0')).join('');
}
function brandStyleVars() {
  const navy = hexToRgbChannels(BRAND.navy);
  const red = hexToRgbChannels(BRAND.red);
  const ch = (a) => a.join(' ');
  return {
    '--navy': BRAND.navy,
    '--red': BRAND.red,
    '--navy-rgb': ch(navy),
    '--navy2-rgb': ch(mixChannels(navy, 0.10)),
    '--navy3-rgb': ch(mixChannels(navy, 0.22)),
    '--red-rgb': ch(red),
    '--vurgu': BRAND.red,
    '--vurgu-uzeri-metin': contrastSafeText(red),
    // CTA arka planı: AA-güvenli değilse marka renginin koyu türevi, aksi halde marka rengi.
    '--vurgu-btn': ctaBgHex(red) || BRAND.red,
  };
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="tr"
      className={`${montserrat.variable} ${inter.variable} ${mono.variable}`}
      style={brandStyleVars()}
    >
      <body className="min-h-screen text-slate-800 font-body antialiased">
        <PWARegister />
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar brandName={BRAND.name} logoInitial={BRAND.logoInitial} panelSubtitle={BRAND.panelSubtitle} />
          <main className="flex-1 min-w-0 overflow-x-hidden pb-16 md:pb-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
