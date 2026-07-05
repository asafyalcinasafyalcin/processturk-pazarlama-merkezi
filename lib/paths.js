import path from 'node:path';

// Uygulama kökü (Processturk_Pazarlama_Merkezi). Next.js sunucusu bu klasörden çalışır.
export const APP_ROOT = process.cwd();

// Workspace kökü — bir üst klasör (PROCESSTURK AI). Sibling projeler (ör. landing) için.
export const WORKSPACE_ROOT = path.resolve(APP_ROOT, '..');

// ── ÇOK-KİRACI (multi-tenant) VERİ İZOLASYONU ────────────────────────────────
// Her tenant kendi veri ad-uzayında yaşar; 2. kiracı ProcessTürk ürün/içerik/kampanya
// verisini GÖRMEZ. Kiracı = BRAND_ID (marka motoruyla aynı anahtar).
//   · processturk (varsayılan): eski yol `data/`  → mevcut dosyalar KORUNUR, veri kaybı yok
//   · diğer BRAND_ID:            `data/<BRAND_ID>/` → ayrı, boş/izole veri seti
// Yalın harf/rakam/tire dışını süz (path traversal + geçersiz klasör adı koruması).
export function tenantId() {
  const raw = (process.env.BRAND_ID || 'processturk').toLowerCase().trim();
  const safe = raw.replace(/[^a-z0-9-]/g, '');
  return safe || 'processturk';
}

// Kiracının kök veri klasörü. processturk → app kökü `data/`; diğer → `data/<tenant>`.
export function dataDir() {
  const tid = tenantId();
  const base = path.join(APP_ROOT, 'data');
  return tid === 'processturk' ? base : path.join(base, tid);
}

// Tek kaynak ürün verisi — kiracı-farkındalıklı.
//  1) PRODUCTS_JSON_PATH (açık override — tam yol, tenant'tan bağımsız)
//  2) <dataDir()>/products.json  (processturk=data/, diğer=data/<tenant>/)
export function productsJsonPath() {
  if (process.env.PRODUCTS_JSON_PATH) return process.env.PRODUCTS_JSON_PATH;
  return path.join(dataDir(), 'products.json');
}

export function stateFile(name) {
  return path.join(dataDir(), name);
}

// Reklam motoru kökü (kampanya/creative scriptleri) — artık panel altında reklam/.
export function metaReklamRoot() {
  if (process.env.META_REKLAM_PATH) return process.env.META_REKLAM_PATH;
  return path.join(APP_ROOT, 'reklam');
}
