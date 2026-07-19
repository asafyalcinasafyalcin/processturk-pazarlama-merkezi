import { promises as fs } from 'node:fs';
import fsSync from 'node:fs';
import path from 'node:path';

// ATOMİK JSON YAZMA — veri dosyalarının tek yazma yolu.
//
// ── NEDEN VAR (2026-07-19'da gerçek veri kaybı yaşandı) ──
// Panelin tüm verisi düz JSON dosyalarında: products.json, content.json,
// calendar.json, library.json. Bunlar `fs.writeFile` ile yazılıyordu.
//
// writeFile dosyayı ÖNCE SIFIRLAR, sonra içeriği yazar. Yazma yarıda kesilirse
// (disk dolu / süreç öldürülür / konteyner yeniden başlar) geriye BOŞ ya da
// YARIM dosya kalır — eski içerik geri getirilemez.
//
// Yaşanan: tekrarlı Docker build'leri diski doldurdu → ENOSPC → content.json
// 0 bayta düştü → ürün detay sayfası "Server Components render error" verdi.
// 30 ürünün üretilmiş içerik kaydı kayboldu (git kopyasından geri yüklendi).
//
// ── ÇÖZÜM ──
// Geçici dosyaya yaz, fsync ile diske indir, sonra rename ile yerine koy.
// rename POSIX'te ATOMİKTİR: ya tamamen olur ya hiç olmaz. Yazma başarısız
// olursa hedef dosyaya HİÇ DOKUNULMAZ, eski içerik sağlam kalır.
//
// Ayrıca yazmadan önce JSON.stringify sonucu doğrulanır — bozuk veri diske
// hiç inmez.


// Yazmadan ÖNCE veriyi doğrula. Amaç: iyi veriyi kazara EZMEYİ engellemek.
//
// ⚠️ Bu fonksiyon bir testin yakaladığı gerçek açık yüzünden var: ilk sürümde
// yalnız "JSON.parse edilebiliyor mu + 3 karakterden uzun mu" bakılıyordu.
// `null` her ikisini de GEÇİYORDU (JSON.stringify(null) === "null", 4 karakter)
// ve dosyayı "null" ile ezip veriyi yok ediyordu — önlemek istediğim şeyin ta kendisi.
// Veri dosyalarımızın kökü DAİMA nesne ya da dizidir; başka bir şey hatadır.
function dogrulaVeri(veri, dosya, fn) {
  if (veri === null || veri === undefined) {
    throw new Error(`${fn}: veri null/undefined — yazma iptal, mevcut dosya korundu (${dosya})`);
  }
  if (typeof veri !== 'object') {
    throw new Error(`${fn}: kök değer nesne/dizi olmalı, gelen: ${typeof veri} (${dosya})`);
  }
  let metin;
  try {
    metin = JSON.stringify(veri);
  } catch (e) {
    throw new Error(`${fn}: JSON'a çevrilemedi (${dosya}): ${e.message}`);
  }
  if (metin === undefined) {
    throw new Error(`${fn}: JSON.stringify undefined döndü — yazma iptal (${dosya})`);
  }
}

/**
 * @param {string} dosya  hedef dosyanın tam yolu
 * @param {any} veri      JSON'a çevrilecek nesne
 */
export async function atomikJsonYaz(dosya, veri, { girinti = 2 } = {}) {
  dogrulaVeri(veri, dosya, 'atomikJsonYaz');
  const metin = JSON.stringify(veri, null, girinti) + '\n';

  const dizin = path.dirname(dosya);
  await fs.mkdir(dizin, { recursive: true });
  // Geçici ad aynı DİZİNDE olmalı — rename yalnız aynı dosya sisteminde atomiktir.
  const gecici = path.join(dizin, `.${path.basename(dosya)}.tmp-${process.pid}-${Date.now()}`);

  let fh;
  try {
    fh = await fs.open(gecici, 'w');
    await fh.writeFile(metin, 'utf-8');
    await fh.sync();   // veriyi gerçekten diske indir (sayfa önbelleğinde bırakma)
    await fh.close();
    fh = null;
    await fs.rename(gecici, dosya);   // ATOMİK yer değiştirme
  } catch (e) {
    if (fh) { try { await fh.close(); } catch { /* yoksay */ } }
    try { await fs.unlink(gecici); } catch { /* yoksay */ }
    // Hata YUTULMAZ: çağıran yazmanın olmadığını bilmeli.
    throw e;
  }
}

/**
 * Senkron sürüm — senkron API kullanan modüller için (ör. library.js).
 * Aynı garanti: geçici dosya + fsync + atomik rename.
 */
export function atomikJsonYazSync(dosya, veri, { girinti = 2 } = {}) {
  dogrulaVeri(veri, dosya, 'atomikJsonYazSync');
  const metin = JSON.stringify(veri, null, girinti) + '\n';
  const dizin = path.dirname(dosya);
  fsSync.mkdirSync(dizin, { recursive: true });
  const gecici = path.join(dizin, `.${path.basename(dosya)}.tmp-${process.pid}-${Date.now()}`);
  let fd;
  try {
    fd = fsSync.openSync(gecici, 'w');
    fsSync.writeFileSync(fd, metin, 'utf-8');
    fsSync.fsyncSync(fd);
    fsSync.closeSync(fd);
    fd = null;
    fsSync.renameSync(gecici, dosya);
  } catch (e) {
    if (fd !== null && fd !== undefined) { try { fsSync.closeSync(fd); } catch { /* yoksay */ } }
    try { fsSync.unlinkSync(gecici); } catch { /* yoksay */ }
    throw e;
  }
}

/**
 * Bozuk dosyayı KAYBETMEDEN kenara alır. Bozuk JSON okunduğunda çağrılır:
 * dosya `.BOZUK-<zaman>` adıyla saklanır, böylece üzerine yazılıp yok olmaz.
 * (library.js'te bozuk dosya sessizce [] dönüyordu ve ilk yazmada içerik
 *  kalıcı olarak siliniyordu — bozulmayı veri kaybına çeviren asıl mekanizma buydu.)
 */
export function bozuguKenaraAl(dosya) {
  try {
    if (!fsSync.existsSync(dosya)) return null;
    const hedef = `${dosya}.BOZUK-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fsSync.renameSync(dosya, hedef);
    console.error(`[atomik-yaz] BOZUK dosya kenara alındı: ${hedef} — veri kaybı DEĞİL, incelenebilir.`);
    return hedef;
  } catch (e) {
    console.error(`[atomik-yaz] bozuk dosya kenara alınamadı (${dosya}): ${e.message}`);
    return null;
  }
}
