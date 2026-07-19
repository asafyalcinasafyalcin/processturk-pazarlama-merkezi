import { promises as fs } from 'node:fs';
import { atomikJsonYaz } from './atomik-yaz.js';
import { productsJsonPath } from './paths.js';

// products.json mevcut reklam motoru şemasıyla paylaşılır. Çekirdek alanları
// (code, slug, name_en, category, price_usd, price_text, specs, video, source_image, hd)
// import_prices.py ve Meta scriptleri okuyabilsin diye AYNEN korunur. Onboarding'in
// topladığı pazarlama bilgisi opsiyonel `marketing` objesine yazılır — eski okuyucular
// bu ekstra anahtarı görmezden gelir.

export async function readProducts() {
  try {
    const raw = await fs.readFile(productsJsonPath(), 'utf-8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeProducts(list) {
  const file = productsJsonPath();
  await atomikJsonYaz(file, list);
  return file;
}

export function slugify(s = '') {
  return String(s)
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function formatPriceText(usd) {
  const n = Number(usd);
  if (!Number.isFinite(n) || n <= 0) return '';
  return n.toLocaleString('en-US') + ' USD';
}

// Onboarding payload → products.json kaydı (çekirdek şema + marketing bloğu).
export function buildProductRecord(payload, existingSlugs = []) {
  let slug = payload.slug ? slugify(payload.slug) : slugify(payload.name_en || payload.name_tr || '');
  if (!slug) slug = 'urun-' + Date.now();
  // Slug çakışmasını önle
  let unique = slug;
  let i = 2;
  while (existingSlugs.includes(unique)) unique = `${slug}-${i++}`;

  const priceUsd = Number(payload.price_usd) || 0;

  return {
    code: payload.code || `PRO-${unique.toUpperCase().replace(/-/g, '')}-001`,
    slug: unique,
    name_en: payload.name_en || payload.name_tr || unique,
    category: payload.category || 'Genel',
    price_usd: priceUsd,
    price_text: payload.price_text || formatPriceText(priceUsd),
    specs: {
      filled_products: payload.specs?.filled_products || '',
      filling_range: payload.specs?.filling_range || '',
      capacity: payload.specs?.capacity || '',
      size: payload.specs?.size || '',
      power: payload.specs?.power || '',
      voltage: payload.specs?.voltage || '',
    },
    video: payload.video || '',
    source_image: payload.source_image || '',
    hd: Boolean(payload.hd),
    marketing: {
      name_tr: payload.name_tr || '',
      audience: payload.audience || '',          // kim paketliyor/üretiyor
      promise: payload.promise || '',            // tek cümle vaat
      hero_number: payload.hero_number || '',    // öne çıkan rakam (fiyat/kapasite/teslim)
      countries: payload.countries || [],        // hedef ülkeler
      languages: payload.languages || ['tr', 'en'],
      notes: payload.notes || '',
      created_at: new Date().toISOString(),
    },
  };
}

export async function addProduct(payload) {
  const list = await readProducts();
  const record = buildProductRecord(payload, list.map((p) => p.slug));
  list.push(record);
  await writeProducts(list);
  return record;
}

export async function findProduct(slug) {
  const list = await readProducts();
  return list.find((p) => p.slug === slug) || null;
}
