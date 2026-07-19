// Web Sitesi ürün eşitleme — Processturk_Web_Sitesi kataloğunu (yayınlanan makine + hat)
// products.json'a TEK YÖNLÜ aktarır. Site tek kaynaktır; panel siteyi ASLA değiştirmez.
//
// KORUMA KURALLARI (Asaf'ın talebi):
//  · SİLME YOK — panel ürünleri asla silinmez; siteden kalkan ürün yalnız işaretlenir.
//  · Mevcut kaydın slug/code'u DEĞİŞMEZ → kampanya creative klasörleri (reklam/campaigns/
//    */creatives/<slug>/) ve üretilmiş görseller aynı ürüne bağlı kalır.
//  · Excel'den gelen RESMİ satış fiyatı (price_usd>0) korunur; site fiyatı yalnız kayıtta
//    fiyat yokken ve sitede priceConfirmed iken yazılır (feed zaten onaysız fiyat vermez).
//  · marketing bloğu Asaf'ındır — yalnız BOŞ alanlar doldurulur.
//  · Site görselleri data/uploads'a indirilir (media-store) → /api/media ile servis edilir,
//    Varlık Kütüphanesi'ne eklenir (kaynak URL ile dedupe). Mevcut görseller silinmez.
import fs from 'node:fs';
import { atomikJsonYazSync } from './atomik-yaz.js';
import path from 'node:path';
import { APP_ROOT, WORKSPACE_ROOT, stateFile } from './paths.js';
import { readProducts } from './products.js';
import { productsJsonPath } from './paths.js';
import { readSettings } from './settings.js';
import { saveFromUrl } from './media-store.js';
import { addToLibrary, listLibrary } from './library.js';
import { getContent, patchContent } from './content.js';

const STATE = () => stateFile('website-sync.json');
const TTL_MS = 10 * 60 * 1000; // otomatik eşitleme aralığı (panel açılışında)
const FEED_PATH = '/api/export/products';

// Panel (eski Excel) slug'ı → site slug'ı. Otomatik eşleşmeyen bilinen ürünler.
// Yeni istisnalar data/website-sync.json → "aliases" ile eklenebilir (elle).
const DEFAULT_ALIASES = {
  'sivi-dolum-4nozul': 'sivi-dolum-hatti',        // 4x1 Servo Lineer Dolum
  'etiketleme-yari': 'yari-otomatik-etiketleme',
  'etiketleme-oto': 'tam-otomatik-etiketleme',
  'tek-hat-kapatma': 'tek-hat-kapak-kapatma',
  'iki-hat-kapatma': 'cift-hat-kapak-kapatma',
  'can-kapatma-oto': 'konserve-kapatma-makinesi',
  'sos-hatti-anahtar-teslim': 'sos-uretim-hatti', // Turnkey Sauce ↔ SAUCE Serisi
};

// Site adresi adayları — ilki yanıt veren kullanılır, state'e yazılır.
const BASE_CANDIDATES = [
  'http://127.0.0.1:4192',            // yerel geliştirme
  'http://processturk-web:3000',      // VPS coolify ağı (container içi port 3000)
  'https://web.72.60.134.242.nip.io', // canlı (her yerden erişilir)
  'https://processturk.com',
];

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE(), 'utf-8')) || {}; } catch { return {}; }
}
function writeState(state) {
  fs.mkdirSync(path.dirname(STATE()), { recursive: true });
  atomikJsonYazSync(STATE(), state);
}

export function getWebsiteSyncStatus() {
  const s = readState();
  return { lastSyncAt: s.lastSyncAt || null, base: s.base || null, lastResult: s.lastResult || null };
}

async function fetchFeed(base, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(base + FEED_PATH, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.ok && Array.isArray(json.products) ? json : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Site adresini bul + feed'i getir. Sıra: env → settings → son çalışan → adaylar.
async function resolveFeed(state) {
  const tried = new Set();
  const candidates = [];
  if (process.env.WEBSITE_URL) candidates.push(process.env.WEBSITE_URL);
  try {
    const st = await readSettings();
    if (st?.websiteUrl) candidates.push(st.websiteUrl);
  } catch { /* yoksay */ }
  if (state.base) candidates.push(state.base);
  candidates.push(...BASE_CANDIDATES);

  for (const raw of candidates) {
    const base = String(raw || '').replace(/\/+$/, '');
    if (!base || tried.has(base)) continue;
    tried.add(base);
    const feed = await fetchFeed(base, base.includes('127.0.0.1') || base.includes('processturk-web') ? 4000 : 8000);
    if (feed) return { base, feed };
  }
  return null;
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function i18nText(v, lang = 'en') {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v[lang] || v.en || v.tr || Object.values(v)[0] || '';
}

// Site ürünü ↔ panel kaydı eşleştirme: alias → slug → tire-sınırlı önek → ad eşitliği.
function findMatch(item, records, aliases) {
  for (const r of records) {
    if (aliases[r.slug] === item.slug) return r;
  }
  const direct = records.find((r) => r.slug === item.slug);
  if (direct) return direct;
  const prefix = records.find((r) => item.slug.startsWith(r.slug + '-') || r.slug.startsWith(item.slug + '-'));
  if (prefix) return prefix;
  const n = norm(i18nText(item.name, 'en'));
  return records.find((r) => n && norm(r.name_en) === n) || null;
}

// Site specs listesinden ([{k:i18n,v:i18n}]) panel şemasının 6 sabit alanına ısıtma.
const SPEC_KEYWORDS = {
  power: ['güç', 'power'],
  voltage: ['voltaj', 'voltage', 'gerilim'],
  size: ['boyut', 'ölçü', 'olcu', 'dimension', 'size'],
  filling_range: ['dolum aralı', 'filling range', 'gramaj', 'dolum hacmi'],
  filled_products: ['uygun ürün', 'suitable', 'doldurulan'],
  capacity: ['kapasite', 'capacity'],
};
function mapSpecs(item) {
  const out = {};
  for (const row of item.specs || []) {
    const label = (i18nText(row?.k, 'tr') + ' ' + i18nText(row?.k, 'en')).toLowerCase();
    const val = i18nText(row?.v, 'en') || i18nText(row?.v, 'tr');
    if (!val) continue;
    for (const [field, words] of Object.entries(SPEC_KEYWORDS)) {
      if (!out[field] && words.some((w) => label.includes(w))) { out[field] = val; break; }
    }
  }
  if (!out.capacity && item.capacity) out.capacity = item.capacity;
  if (!out.filled_products && Array.isArray(item.suitableProducts) && item.suitableProducts.length) {
    out.filled_products = item.suitableProducts.map((x) => i18nText(x, 'en')).filter(Boolean).slice(0, 8).join(', ');
  }
  return out;
}

function priceText(price) {
  if (!price) return '';
  const f = Number(price.from).toLocaleString('en-US');
  const t = Number(price.to).toLocaleString('en-US');
  const cur = price.currency || 'USD';
  return price.to > price.from ? `${f} – ${t} ${cur}` : `${f} ${cur}`;
}

// source_image çözülebiliyor mu? (mutlak, workspace-göreli veya app-göreli)
function sourceImageExists(rec) {
  const p = rec?.source_image;
  if (!p) return false;
  const cands = path.isAbsolute(p) ? [p] : [path.join(WORKSPACE_ROOT, p), path.join(APP_ROOT, p)];
  return cands.some((c) => { try { return fs.existsSync(c); } catch { return false; } });
}

// Görseli indir (bütçeli) — kütüphaneye ekle, {source, servedUrl, absPath} döner.
async function importImage(absUrl, slug, budget) {
  const existing = listLibrary(slug).find((e) => e.websiteSource === absUrl && (e.url || e.localPath));
  if (existing) return { source: absUrl, servedUrl: existing.url || existing.localPath, cached: true };
  if (budget.left <= 0) return null; // bu turda bütçe bitti — sonraki eşitlemede tamamlanır
  try {
    const { servedUrl, absPath } = await saveFromUrl(absUrl, { slug, type: 'gorsel' });
    budget.left--;
    budget.downloaded++;
    addToLibrary(slug, 'gorsel', {
      url: servedUrl, localPath: servedUrl,
      imageSource: 'website', websiteSource: absUrl,
      at: new Date().toISOString(),
    });
    return { source: absUrl, servedUrl, absPath };
  } catch {
    return null;
  }
}

// Ana eşitleme. force=false → TTL içindeyse hiçbir şey yapmadan döner.
export async function syncWebsiteProducts({ force = false, maxImageDownloads = 12 } = {}) {
  const state = readState();
  if (!force && state.lastSyncAt && Date.now() - Date.parse(state.lastSyncAt) < TTL_MS) {
    return { ok: true, skipped: true, ...getWebsiteSyncStatus() };
  }

  const resolved = await resolveFeed(state);
  if (!resolved) {
    return { ok: false, error: 'Web sitesine ulaşılamadı (WEBSITE_URL / 4192 / canlı adres).', lastSyncAt: state.lastSyncAt || null };
  }
  const { base, feed } = resolved;

  const records = await readProducts();
  const aliases = { ...DEFAULT_ALIASES, ...(state.aliases || {}) };
  const budget = { left: Math.max(0, maxImageDownloads), downloaded: 0 };
  const summary = { added: [], linked: [], updated: 0, imagesDownloaded: 0, pendingImages: 0, removedFromSite: [] };
  const seenWebSlugs = new Set();

  for (const item of feed.products) {
    seenWebSlugs.add(item.slug);
    let rec = findMatch(item, records, aliases);
    const isNew = !rec;

    if (isNew) {
      // Sitede olup panelde olmayan ürün → yeni kayıt (site slug'ı ile).
      rec = {
        code: `WEB-${item.slug.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 40)}`,
        slug: item.slug,
        name_en: i18nText(item.name, 'en') || item.slug,
        category: '',
        price_usd: 0,
        price_text: '',
        specs: { filled_products: '', filling_range: '', capacity: '', size: '', power: '', voltage: '' },
        video: '',
        source_image: '',
        hd: false,
        marketing: {
          name_tr: i18nText(item.name, 'tr'),
          audience: '',
          promise: i18nText(item.summary, 'tr'),
          hero_number: item.capacity || '',
          countries: [],
          languages: ['tr', 'en'],
          notes: 'Web sitesinden otomatik eklendi',
          created_at: new Date().toISOString(),
        },
      };
      records.push(rec);
      summary.added.push(item.slug);
    } else if (!rec.website) {
      summary.linked.push(`${rec.slug} ↔ ${item.slug}`);
    }

    // ── Site → panel alan güncellemeleri (site tek kaynak) ──
    rec.name_en = i18nText(item.name, 'en') || rec.name_en;
    const webCategory = i18nText(item.category?.name, 'en');
    if (webCategory) rec.category = webCategory;           // ürün grupları siteden gelir
    if (item.video) rec.video = item.video;

    // Specs: yalnız BOŞ alanlar doldurulur (Excel teknik verisi ezilmez).
    const mapped = mapSpecs(item);
    rec.specs = rec.specs || {};
    for (const [k, v] of Object.entries(mapped)) {
      if (!rec.specs[k]) rec.specs[k] = v;
    }

    // Fiyat: kayıtta resmi fiyat yoksa sitedeki ONAYLI fiyat yazılır.
    if (!(Number(rec.price_usd) > 0) && item.price) {
      if (item.price.currency === 'USD' && item.price.to === item.price.from) rec.price_usd = item.price.from;
      if (!rec.price_text) rec.price_text = priceText(item.price);
    }

    // marketing: yalnız boş alanlar.
    rec.marketing = rec.marketing || {};
    if (!rec.marketing.name_tr) rec.marketing.name_tr = i18nText(item.name, 'tr');
    if (!rec.marketing.promise) rec.marketing.promise = i18nText(item.summary, 'tr');
    if (!rec.marketing.hero_number && item.capacity) rec.marketing.hero_number = item.capacity;

    // ── Görseller: ana görsel + galeri (ilk 4) ──
    const prevWebsite = rec.website || {};
    let image = prevWebsite.image || null;
    if (item.image) {
      const absUrl = new URL(item.image, base + '/').toString();
      if (!image || image.source !== absUrl) {
        const got = await importImage(absUrl, rec.slug, budget);
        if (got) image = got; else if (!image) summary.pendingImages++;
      }
    }
    const gallery = [];
    for (const g of (item.gallery || []).slice(0, 8)) {
      const absUrl = new URL(g, base + '/').toString();
      const prev = (prevWebsite.gallery || []).find((x) => x.source === absUrl);
      const got = prev || (await importImage(absUrl, rec.slug, budget));
      if (got) gallery.push({ source: absUrl, servedUrl: got.servedUrl });
      else summary.pendingImages++;
    }

    // İndirilen site görselini ürüne bağla: içerik görseli boşsa + source_image çözülemiyorsa.
    if (image?.servedUrl) {
      rec.hd = true;
      if (!sourceImageExists(rec)) rec.source_image = `data/uploads/${path.basename(image.servedUrl)}`;
      try {
        const cur = await getContent(rec.slug);
        if (!cur?.gorsel?.url && !cur?.gorsel?.localPath) {
          await patchContent(rec.slug, {
            gorsel: { url: image.servedUrl, localPath: image.servedUrl, imageSource: 'website', at: new Date().toISOString() },
          });
        }
      } catch { /* içerik state hatası eşitlemeyi durdurmasın */ }
    }

    // ── website bloğu: sitenin tam sürümü (reklam metni üretimi i18n adları buradan alır) ──
    rec.website = {
      type: item.type,
      slug: item.slug,
      url: base + (item.path || `/tr/${item.type === 'line' ? 'hatlar' : 'makineler'}/${item.slug}`),
      name: item.name || null,
      summary: item.summary || null,
      category: item.category || null,
      capacity: item.capacity || '',
      deliveryWeeks: item.deliveryWeeks || '',
      automation: item.automation || '',
      material: item.material || '',
      specs: (item.specs || []).slice(0, 16),
      highlights: item.highlights || [],
      badge: item.badge || null,
      price: item.price || null,
      variants: item.variants || [],
      // Detay sayfası içeriği (açıklama, SSS, üretim akışı…) — brief üretimi
      // sitedeki GERÇEK metinden beslensin diye tam alınır. Fiyat içermez.
      content: item.content || null,
      image: image ? { source: image.source, servedUrl: image.servedUrl } : null,
      gallery,
      syncedAt: new Date().toISOString(),
      removedFromSite: null,
    };
    summary.updated++;
  }

  // Siteden kalkan ürünler: kayıt SİLİNMEZ, yalnız işaretlenir.
  for (const rec of records) {
    if (rec.website?.slug && !seenWebSlugs.has(rec.website.slug)) {
      if (!rec.website.removedFromSite) rec.website.removedFromSite = new Date().toISOString();
      summary.removedFromSite.push(rec.slug);
    }
  }

  summary.imagesDownloaded = budget.downloaded;
  atomikJsonYazSync(productsJsonPath(), records);
  writeState({ ...state, lastSyncAt: new Date().toISOString(), base, aliases: state.aliases || {}, lastResult: summary });

  return { ok: true, base, total: records.length, siteCount: feed.products.length, ...summary };
}
