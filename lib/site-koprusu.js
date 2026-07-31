// SİTE KÖPRÜSÜ — Pazarlama Merkezi ↔ Web Sitesi (processturk.com) makine yolu.
//
// İki yön:
//   ① İÇERİK AYNASI (oku): sitenin ürettiği blog/sosyal plan öğelerini panelde göster.
//   ② GÖRSEL GÖNDER (yaz): paneldeki bir varlığı sitenin medya kütüphanesine aktar.
//
// Her ikisi de sitedeki `PAZARLAMA_API_KEY` paylaşılan sırrıyla korunur (x-api-key).
// Anahtar iki tarafta da AYNI olmalı; yoksa site 401 döner (fail-closed, bilinçli).
import { getWebsiteSyncStatus } from './website-sync.js';
import { BRAND } from './brand.js';

// SUNUCU tarafı adres — panelin kendi fetch'i buradan gider. Canlıda genelde docker
// ağ adı (`http://processturk-web:3000`) olur; hızlı ve dış ağa çıkmaz.
// website-sync.js zaten aday listesini deneyip çalışanı state'e yazıyor — onu tekrar
// keşfetmek yerine oradan okuyoruz (tek kaynak).
export function siteTabani() {
  if (process.env.WEBSITE_URL) return process.env.WEBSITE_URL.replace(/\/$/, '');
  const s = getWebsiteSyncStatus();
  if (s.base) return String(s.base).replace(/\/$/, '');
  return sitePublicTabani();
}

// ⚠️ TARAYICI tarafı adres — AYRI olmak ZORUNDA. `siteTabani()` canlıda docker konteyner
// adı döndürür ve tarayıcı onu ÇÖZEMEZ: görsel <img src> kırık çıkar, "sitede aç" linki
// ölür (2026-07-31'de canlıda küçük resimler boş kutuydu, sebebi buydu). Sitenin kendi
// deploy scripti de aynı uyarıyı taşır: "İÇ adres değil, TARAYICININ gideceği KAMUYA
// AÇIK adres". Marka kaydından türer → white-label güvenli.
export function sitePublicTabani() {
  if (process.env.WEBSITE_PUBLIC_URL) return process.env.WEBSITE_PUBLIC_URL.replace(/\/$/, '');
  return `https://${BRAND.web}`;
}

function anahtar() {
  return process.env.PAZARLAMA_API_KEY || '';
}

export function koprüHazir() {
  return Boolean(anahtar());
}

/** ① Sitedeki içeriği (sosyal plan öğeleri + yayınlanan bloglar) oku. */
export async function siteIcerigiGetir(limit = 60) {
  if (!anahtar()) throw new Error('PAZARLAMA_API_KEY tanımlı değil — site köprüsü kapalı.');
  const url = `${siteTabani()}/api/export/icerik?limit=${encodeURIComponent(limit)}`;
  const res = await fetch(url, { headers: { 'x-api-key': anahtar() }, cache: 'no-store' });
  if (res.status === 401) throw new Error('Site anahtarı reddetti (PAZARLAMA_API_KEY iki tarafta aynı mı?).');
  // 404 = uç sitede HENÜZ YOK. Bu bir arıza değil, eksik deploy — mesaj bunu net söylemeli,
  // yoksa "502 Bad Gateway" görüp site çökmüş sanılıyor (2026-07-31).
  if (res.status === 404) {
    const e = new Error('Sitede içerik ucu bulunamadı — /api/export/icerik henüz yayına alınmamış.');
    e.eksikDeploy = true;
    throw e;
  }
  if (!res.ok) throw new Error(`Site içerik ucu ${res.status}`);
  const d = await res.json();
  if (!d.ok) throw new Error(d.hata || 'Site içerik ucu hata döndü.');
  return { ogeler: d.ogeler || [], bloglar: d.bloglar || [] };
}

/** ② Paneldeki bir medya URL'ini siteye gönder (site indirir ve kendi kütüphanesine yazar). */
export async function siteyeMedyaGonder({ url, ad, etiket }) {
  if (!anahtar()) throw new Error('PAZARLAMA_API_KEY tanımlı değil — site köprüsü kapalı.');
  const res = await fetch(`${siteTabani()}/api/medya-al`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': anahtar() },
    body: JSON.stringify({ url, ad, etiket }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.ok) throw new Error(d.hata || `Site medya ucu ${res.status}`);
  return d; // { ok, url, id }
}
