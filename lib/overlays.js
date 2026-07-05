import sharp from 'sharp';
import fs from 'node:fs';
import { BRAND } from './brand.js';

// v2.1 — 9:16 overlay/kart üreticisi. Video marka renkleri marka kaydından (brand.js →
// _core/brands/<BRAND_ID>.json): videoNavy/videoRed. BRAND_ID yoksa ProcessTürk varsayılanı.
// Tüm metin SVG→PNG (sharp). Logo TÜM sahnelerde sağ-üst sabit (marka logo PNG'si).
export const W = 1080, H = 1920;
const NAVY = BRAND.videoNavy, NAVY2 = '#22356f', RED = BRAND.videoRed;
const FONT = `${BRAND.fontSans}, "Helvetica Neue", Arial, sans-serif`;
const PAD = 56, LOGO_W = 200;

function esc(s = '') { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function wrap(text, max = 20) {
  const words = String(text || '').split(/\s+/);
  const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}
function tspans(lines, x, y0, lh, attrs = '') {
  return lines.map((l, i) => `<text x="${x}" y="${y0 + i * lh}" ${attrs}>${esc(l)}</text>`).join('');
}
async function svgToPng(svg) { return await sharp(Buffer.from(svg)).png().toBuffer(); }

async function logoBuf(logoPath, width = LOGO_W) {
  try { if (!logoPath || !fs.existsSync(logoPath)) return null; return await sharp(logoPath).resize({ width }).png().toBuffer(); }
  catch { return null; }
}
// Sağ-üst logo + arkasına okunabilirlik için hafif koyu chip (video üstünde de görünür)
async function withCornerLogo(baseBuf, logoPath, chip = false) {
  const logo = await logoBuf(logoPath);
  if (!logo) return baseBuf;
  const meta = await sharp(logo).metadata();
  const lw = meta.width || LOGO_W, lh = meta.height || 60;
  const left = W - lw - PAD, top = PAD;
  const comp = [];
  if (chip) {
    const chipSvg = `<svg width="${lw + 32}" height="${lh + 24}" xmlns="http://www.w3.org/2000/svg"><rect width="${lw + 32}" height="${lh + 24}" rx="16" fill="${NAVY}" opacity="0.55"/></svg>`;
    comp.push({ input: await svgToPng(chipSvg), top: top - 12, left: left - 16 });
  }
  comp.push({ input: logo, top, left });
  return await sharp(baseBuf).composite(comp).png().toBuffer();
}

function prettyPhone(intl) {
  const s = String(intl || '').replace(/\D/g, '');
  const r = s.startsWith('90') ? s.slice(2) : s;
  if (r.length === 10) return `0${r.slice(0, 3)} ${r.slice(3, 6)} ${r.slice(6, 8)} ${r.slice(8, 10)}`;
  return intl;
}

// ── Altyazı overlay (şeffaf, alt-üçlük) — kanca/fayda sahneleri için. Logo sağ-üst. ──
export async function captionOverlay({ lines, logoPath, rtl = false }) {
  const all = (Array.isArray(lines) ? lines : [lines]).filter(Boolean).flatMap((l) => wrap(l, 24));
  const boxH = all.length * 78 + 56;
  const boxY = H - 430 - boxH;
  const tx = rtl ? W - 104 : 104;
  const dir = rtl ? "direction='rtl' " : '';
  const anchor = rtl ? "text-anchor='end' " : '';
  const barX = rtl ? W - 56 - 13 : 56;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="56" y="${boxY}" width="${W - 112}" height="${boxH}" rx="26" fill="${NAVY}" opacity="0.74"/>
    <rect x="${barX}" y="${boxY}" width="13" height="${boxH}" rx="6" fill="${RED}"/>
    ${tspans(all, tx, boxY + 66, 78, `${dir}${anchor}font-family='${FONT}' font-size='56' font-weight='700' fill='#ffffff'`)}
  </svg>`;
  return await withCornerLogo(await svgToPng(svg), logoPath, true);
}

// ── Güven kartı (navy) ──
export async function trustCard({ lines, logoPath, rtl = false }) {
  const ls = (lines || []).flatMap((l) => wrap(l, 20));
  const y0 = H / 2 - (ls.length * 100) / 2;
  const dir = rtl ? "direction='rtl' " : '';
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NAVY2}"/><stop offset="1" stop-color="${NAVY}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect x="${W / 2 - 60}" y="${y0 - 90}" width="120" height="8" fill="${RED}"/>
    ${tspans(ls, W / 2, y0, 100, `${dir}font-family='${FONT}' font-size='66' font-weight='800' fill='#ffffff' text-anchor='middle'`)}
  </svg>`;
  return await withCornerLogo(await svgToPng(svg), logoPath);
}

// ── Teknik özellik kartı (navy, liste; RTL'de sağ hizalı) ──
export async function specCard({ title, lines, logoPath, rtl = false }) {
  const items = (lines || []).flatMap((l) => wrap(l, 26));
  const y0 = H / 2 - (items.length * 96) / 2;
  const tx = rtl ? W - 110 : 110;
  const dir = rtl ? "direction='rtl' " : '';
  const anchor = rtl ? "text-anchor='end' " : '';
  const barX = rtl ? W - 110 - 180 : 110;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="${NAVY}"/>
    <text x="${tx}" y="${y0 - 120}" ${dir}${anchor}font-family='${FONT}' font-size='48' font-weight='800' fill='${RED}'>${esc(title || 'TEKNİK ÖZELLİK')}</text>
    <rect x="${barX}" y="${y0 - 92}" width="180" height="6" fill="${RED}"/>
    ${tspans(items, tx, y0, 96, `${dir}${anchor}font-family='${FONT}' font-size='58' font-weight='600' fill='#ffffff'`)}
  </svg>`;
  return await withCornerLogo(await svgToPng(svg), logoPath);
}

// ── CTA kartı (navy + WhatsApp buton + web) ──
export async function ctaCard({ title, whatsapp, web, logoPath, rtl = false }) {
  const ls = wrap(title, 18);
  const y0 = H / 2 - 220;
  const btnY = y0 + ls.length * 96 + 70;
  const dir = rtl ? "direction='rtl' " : '';
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="${NAVY}"/>
    ${tspans(ls, W / 2, y0, 96, `${dir}font-family='${FONT}' font-size='72' font-weight='800' fill='#ffffff' text-anchor='middle'`)}
    <rect x="${W / 2 - 380}" y="${btnY}" width="760" height="132" rx="66" fill="${RED}"/>
    <text x="${W / 2}" y="${btnY + 86}" font-family='${FONT}' font-size='56' font-weight='800' fill='#ffffff' text-anchor='middle'>WhatsApp ${esc(prettyPhone(whatsapp))}</text>
    <text x="${W / 2}" y="${btnY + 230}" font-family='${FONT}' font-size='44' font-weight='600' fill='#ADC9EB' text-anchor='middle'>${esc(web || BRAND.web)}</text>
  </svg>`;
  return await withCornerLogo(await svgToPng(svg), logoPath);
}
