#!/usr/bin/env node
/**
 * yeniden-yayinla-onarilan.mjs — TEK SEFERLİK: onarılan reel'leri yeniden yayınlar.
 *
 *   node yeniden-yayinla-onarilan.mjs            # KURU koşum (hiçbir şey gitmez)
 *   node yeniden-yayinla-onarilan.mjs --gonder   # gerçek yayın (Asaf onayı 2026-08-09)
 *
 * NEDEN VAR: 2026-08-09'da üç hat reel'inin cue'ları `null` olduğu için sahneleri
 * 1 kareye çökmüş hâlde CANLIYA çıkmıştı (7 proses adımı 0,03 sn'de geçiyor, CTA
 * 28 saniye donuyor). Kusur onarıldı, videolar yeniden render edildi ve site
 * kopyaları güncellendi. Bu script Meta'daki BOZUK kopyaların yerine onarılmışını
 * koyar — Meta videoyu URL'den kendi sunucusuna çektiği için site düzelmesi
 * geçmiş gönderileri KENDİLİĞİNDEN düzeltmez.
 *
 * ⛔ `yayinla-hat-reel.mjs` KULLANILMADI: o 28 kaydın hepsini yayınlar. Burada
 *    yalnız onarılan üç kayıt hedeflenir.
 * ⚠️ Instagram Graph API media SİLMEYİ DESTEKLEMİYOR (ölçüldü: DELETE → subcode
 *    2207085, gönderi duruyor). Bu yüzden IG'ye yeniden yükleme BU SCRIPT'TE YOK —
 *    eski gönderi silinmeden yenisi yüklenirse akışta mükerrer içerik olur.
 *    IG tarafı Asaf'ın elle silmesine bağlıdır.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BURA = path.dirname(fileURLToPath(import.meta.url));
const GONDER = process.argv.includes('--gonder');

// Onarılan üç kayıt. Caption'lar silinen gönderilerin YEDEĞİNDEN gelir (aynı metin).
const HEDEF = [
  { slug: 'dolum-paketleme-hatti', dil: 'ar', kanal: 'facebook' },
  { slug: 'meyve-suyu-konsantre-hatti', dil: 'ar', kanal: 'facebook' },
];

const kayitlar = JSON.parse(await readFile(path.join(BURA, 'data/sosyal-metinler-hatlar.json'), 'utf8'));

const secili = HEDEF.map((h) => {
  const k = kayitlar.find((x) => x.slug === h.slug && x.dil === h.dil);
  if (!k) throw new Error(`kayıt bulunamadı: ${h.slug}/${h.dil}`);
  return { ...h, reelUrl: k.reelUrl, caption: k.linkedin };
});

console.log(`\n═══ ONARILAN REEL YENİDEN YAYIN ${GONDER ? '(GERÇEK)' : '(KURU)'} ═══`);
for (const s of secili) console.log(`• ${s.kanal.toUpperCase()} ${s.slug} [${s.dil}] → ${s.reelUrl}`);

if (!GONDER) {
  console.log(`\n→ Gerçek yayın için: node yeniden-yayinla-onarilan.mjs --gonder`);
  process.exit(0);
}

const { publishFacebookVideo } = await import('./lib/meta-publish.js');
for (const s of secili) {
  try {
    const r = await publishFacebookVideo({ videoUrl: s.reelUrl, caption: s.caption });
    console.log(`✓ FB ${s.slug}/${s.dil}: ${r?.mediaId || 'ok'}`);
  } catch (e) {
    console.error(`✗ FB ${s.slug}/${s.dil}: ${e.message}`);
  }
}
