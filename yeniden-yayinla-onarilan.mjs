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
 *    yalnız onarılan kayıtlar hedeflenir.
 * ⚠️ Instagram Graph API media SİLMEYİ DESTEKLEMİYOR (ölçüldü 2026-08-09:
 *    DELETE → `error_subcode 2207085`, gönderi permalink'iyle duruyor). Eski bozuk
 *    IG gönderilerini **Asaf elle siler**; Asaf'ın kararıyla (2026-08-09) onarılmış
 *    sürümler silme BEKLENMEDEN yükleniyor — kısa süre iki kopya görünür.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BURA = path.dirname(fileURLToPath(import.meta.url));
const GONDER = process.argv.includes('--gonder');

// Onarılan kayıtlar. FB'dekiler 2026-08-09'da silinip yeniden yüklendi (tamamlandı);
// IG'dekiler eski gönderi silinemediği için Asaf kararıyla ayrıca yükleniyor.
const HEDEF = [
  { slug: 'dolum-paketleme-hatti', dil: 'en', kanal: 'instagram' },
  { slug: 'dolum-paketleme-hatti', dil: 'ar', kanal: 'instagram' },
  { slug: 'meyve-suyu-konsantre-hatti', dil: 'ar', kanal: 'instagram' },
];

// `--yalniz <slug>/<dil>` → tek kaydı yeniden dener. Bir yükleme düştüğünde
// tamamını tekrar koşmak BAŞARILI olanları mükerrer yayınlar; filtre onu önler.
const yalnizArg = process.argv.find((a) => a.startsWith('--yalniz='))?.split('=')[1];

const kayitlar = JSON.parse(await readFile(path.join(BURA, 'data/sosyal-metinler-hatlar.json'), 'utf8'));

const secili = HEDEF.filter((h) => !yalnizArg || `${h.slug}/${h.dil}` === yalnizArg).map((h) => {
  const k = kayitlar.find((x) => x.slug === h.slug && x.dil === h.dil);
  if (!k) throw new Error(`kayıt bulunamadı: ${h.slug}/${h.dil}`);
  // Kanal başına doğru metin alanı: IG → instagram, FB → linkedin (yayinla-hat-reel.mjs deseni)
  return { ...h, reelUrl: k.reelUrl, coverUrl: k.coverUrl, caption: h.kanal === 'instagram' ? k.instagram : k.linkedin };
});

console.log(`\n═══ ONARILAN REEL YENİDEN YAYIN ${GONDER ? '(GERÇEK)' : '(KURU)'} ═══`);
for (const s of secili) {
  console.log(`• ${s.kanal.toUpperCase()} ${s.slug} [${s.dil}] → ${s.reelUrl}`);
  console.log(`    kapak: ${s.coverUrl || '(yok — IG otomatik kare seçer)'}`);
  console.log(`    metin: ${(s.caption || '').split('\n')[0].slice(0, 66)}…`);
}

if (!GONDER) {
  console.log(`\n→ Gerçek yayın için: node yeniden-yayinla-onarilan.mjs --gonder`);
  process.exit(0);
}

const { publishFacebookVideo, publishInstagramReel } = await import('./lib/meta-publish.js');
for (const s of secili) {
  try {
    const r = s.kanal === 'instagram'
      ? await publishInstagramReel({ videoUrl: s.reelUrl, caption: s.caption, coverUrl: s.coverUrl })
      : await publishFacebookVideo({ videoUrl: s.reelUrl, caption: s.caption });
    console.log(`✓ ${s.kanal.toUpperCase()} ${s.slug}/${s.dil}: ${r?.mediaId || r?.id || 'ok'}`);
  } catch (e) {
    console.error(`✗ ${s.kanal.toUpperCase()} ${s.slug}/${s.dil}: ${e.message}`);
  }
}
