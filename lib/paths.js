import path from 'node:path';

// Uygulama kökü (Processturk_Pazarlama_Merkezi). Next.js sunucusu bu klasörden çalışır.
export const APP_ROOT = process.cwd();

// Workspace kökü — bir üst klasör (PROCESSTURK AI). Sibling projeler (ör. landing) için.
export const WORKSPACE_ROOT = path.resolve(APP_ROOT, '..');

// Tek kaynak ürün verisi — artık reklam motoru panele gömülü olduğu için app içi data/.
//  1) PRODUCTS_JSON_PATH (açık override)
//  2) app içi data/products.json (tek kaynak)
export function productsJsonPath() {
  if (process.env.PRODUCTS_JSON_PATH) return process.env.PRODUCTS_JSON_PATH;
  return path.join(APP_ROOT, 'data', 'products.json');
}

// Panelin kendi state klasörü (içerik/kampanya/takvim).
export function dataDir() {
  return path.join(APP_ROOT, 'data');
}

export function stateFile(name) {
  return path.join(dataDir(), name);
}

// Reklam motoru kökü (kampanya/creative scriptleri) — artık panel altında reklam/.
export function metaReklamRoot() {
  if (process.env.META_REKLAM_PATH) return process.env.META_REKLAM_PATH;
  return path.join(APP_ROOT, 'reklam');
}
