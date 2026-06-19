import path from 'node:path';
import fs from 'node:fs';

// Uygulama kökü (Processturk_Pazarlama_Merkezi). Next.js sunucusu bu klasörden çalışır.
export const APP_ROOT = process.cwd();

// Workspace kökü — bir üst klasör (PROCESSTURK AI).
export const WORKSPACE_ROOT = path.resolve(APP_ROOT, '..');

// Tek kaynak ürün verisi.
//  1) PRODUCTS_JSON_PATH (açık override)
//  2) lokal: ../Meta_Reklam_Sistemi/data/products.json (sibling varsa — tek kaynak)
//  3) container/VPS: app içi data/products.json (sibling yoksa)
export function productsJsonPath() {
  if (process.env.PRODUCTS_JSON_PATH) return process.env.PRODUCTS_JSON_PATH;
  const sibling = path.join(WORKSPACE_ROOT, 'Meta_Reklam_Sistemi', 'data', 'products.json');
  if (fs.existsSync(path.dirname(sibling))) return sibling;
  return path.join(APP_ROOT, 'data', 'products.json');
}

// Panelin kendi state klasörü (içerik/kampanya/takvim).
export function dataDir() {
  return path.join(APP_ROOT, 'data');
}

export function stateFile(name) {
  return path.join(dataDir(), name);
}

// Meta_Reklam_Sistemi kökü (kampanya/creative scriptleri için — Faz 4).
export function metaReklamRoot() {
  if (process.env.META_REKLAM_PATH) return process.env.META_REKLAM_PATH;
  return path.join(WORKSPACE_ROOT, 'Meta_Reklam_Sistemi');
}
