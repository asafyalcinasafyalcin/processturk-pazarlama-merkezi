#!/usr/bin/env node
/**
 * KİMLİK KAPSAMI KAPISI — "kenar koruyor" bir VARSAYIMDIR, ölçülür.
 *
 * 🔴 NEDEN VAR (2026-09-08 ölçümü): bu depodaki 41 API ucunun 31'i kendi kimlik
 *    kontrolünü TAŞIMIYOR ve tamamen Traefik'teki `shared-auth@file` katmanına
 *    güveniyor. Bu tek başına bir kusur değil — panel aynı origin'den konuşuyor
 *    ve her uca anahtar koymak paneli kırardı. Kusur, bu güvenin ÖLÇÜLMEMESİ:
 *      · `deploy-server.sh` `pazarlama-auth.basicauth` middleware'ini TANIMLIYOR
 *        ama HİÇBİR router'a BAĞLAMIYOR — dosyanın kendi başlığı "panel dışarıdan
 *        basic auth ile erişilir" diyor, bu BAYAT. Tek savunma `shared-auth@file`.
 *      · İki router o katmandan MUAF ve `priority=1000` taşıyor:
 *        `/api/media` (salt-okuma servis; tarayıcı <img>/<video> kimlik gönderemez)
 *        `/api/website-sync/hook` (kendi fail-closed paylaşılan anahtarı VAR).
 *    Yarın üçüncü bir muaf router eklenirse ve kendi anahtarı olmazsa, yazma
 *    yüzeyi sessizce internete açılır. Bu kapı tam olarak onu yakalar.
 *
 * KURAL: kimlik middleware'i OLMAYAN her Traefik router'ının yolu ya kod içinde
 * kendi kimlik kontrolünü taşıyacak ya da aşağıda GEREKÇESİYLE beyan edilecek.
 *
 * ⛔ Bu kapı "SSO çalışıyor mu" sorusunu CEVAPLAMAZ — o, canlıya karşı ölçülür ve
 *    bu depodan yapılamaz. Kapının ölçtüğü şey YAPILANDIRMANIN TUTARLILIĞIDIR.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DEPLOY = "scripts/deploy-server.sh";
// Kimlik sağlayan middleware adları (gzip/redirect/compress kimlik DEĞİLDİR).
const KIMLIK_MW = /shared-auth|basicauth|auth@|forwardauth/i;

// Kimlik middleware'i olmadan meşru olan yollar + SEBEP.
const BEYANLI = {
  "/api/media": "salt-okuma medya servisi — tarayıcı <img>/<video> istekleri Authorization başlığı GÖNDEREMEZ; yazma yüzeyi yok",
};

const s = existsSync(DEPLOY) ? readFileSync(DEPLOY, "utf8") : "";
if (!s) { console.log("⏭️  ATLANDI — deploy-server.sh okunamadı, yapılandırma ÖLÇÜLMEDİ."); process.exit(0); }

// routers.<ad>.<alan>=<deger> etiketlerini topla
const router = new Map();
// ⚠️ DEĞER SONUNA KADAR OKUNUR (2026-09-08): etiket kabuk çift tırnağı içinde
//    ve `rule` değeri KAÇIŞLI backtick taşıyor (PathPrefix(\`/api/media\`)).
//    İlk yazımda karakter sınıfı `\\`i dışlıyordu → her rule backtick'te kesiliyor
//    ve HER router "/" görünüyordu. Ölçüm aleti yolu yanlış okursa bulgu da yanlış.
for (const m of s.matchAll(/traefik\.http\.routers\.([a-z0-9-]+)\.([a-z.]+)=(.*?)"/gi)) {
  const [, ad, alan, deger] = m;
  if (!router.has(ad)) router.set(ad, {});
  router.get(ad)[alan] = deger.trim();
}

// Kod içi kimlik kontrolü taşıyan uçlar
const KAPI_IZI = /x-admin-token|x-sync-secret|safeEqual|getSession|anahtarKapisi|_TOKEN|_SECRET|401|403/;

/**
 * Bir yol önekinin ALTINDAKİ HER ucun kendi kapısı var mı?
 * ⚠️ İlk yazımda yalnız `app/api/<önek>/route.*` dosyasına bakıyordu ve alt
 *    dizinlere İNMİYORDU. `/api/tiktok` böyle YANLIŞ POZİTİF verdi: o önekte
 *    route dosyası yok, ama altındaki `baglan` ve `callback` uçlarının İKİSİ de
 *    `anahtarKapisi(req)` + CSRF `state` taşıyor. Ölçüm aleti eksik olduğunda
 *    bulgu değil ALETİN KUSURU raporlanır.
 * ⛔ "Bir tanesi taşıyor" YETMEZ — önekin altındaki HEPSİ taşımalı; biri açıksa
 *    o önek açıktır.
 */
function kodKapisiVar(yolOneki) {
  const rel = yolOneki.replace(/^\/api\/?/, "");
  const kok = rel ? join("app/api", rel) : "app/api";
  if (!existsSync(kok)) return null;
  const dosyalar = [];
  (function tara(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const q = join(d, e.name);
      if (e.isDirectory()) tara(q);
      else if (/^route\.[tj]s$/.test(e.name)) dosyalar.push(q);
    }
  })(kok);
  if (!dosyalar.length) return null;
  return dosyalar.every((f) => KAPI_IZI.test(readFileSync(f, "utf8")));
}

let yetim = 0, sayac = 0;
console.log("\n═══ KİMLİK KAPSAMI ═══\n");
for (const [ad, r] of router) {
  if (r.entryPoints === "http") continue;              // yalnız https'e yönlendirir
  const mw = r.middlewares || "";
  const rule = r.rule || "";
  const kimlikli = KIMLIK_MW.test(mw);
  // ⚠️ Kaçışlar ÖNCE temizlenir: kabuk etiketinde backtick'ler ters bölülü
  //    (PathPrefix(\`/api/media\`)) ve düz backtick arayan desen HİÇ eşleşmiyor,
  //    her router "/" görünüyordu — yani kapı yanlış yolu ölçüyordu.
  const temizKural = rule.replace(/\\/g, "");
  const yol = (temizKural.match(/PathPrefix\(`([^`]+)`\)/) || [])[1] || "/";
  sayac++;
  if (kimlikli) { console.log(`  ✅ KİMLİKLİ   ${ad.padEnd(20)} ${yol}  [${mw}]`); continue; }
  const kod = kodKapisiVar(yol);
  if (kod === true) { console.log(`  ✅ KOD KAPISI ${ad.padEnd(20)} ${yol}  (uç kendi anahtarını doğruluyor)`); continue; }
  if (BEYANLI[yol]) { console.log(`  ⏭️  BEYANLI    ${ad.padEnd(20)} ${yol}\n                ${BEYANLI[yol]}`); continue; }
  yetim++;
  console.log(`  ❌ AÇIK       ${ad.padEnd(20)} ${yol} — kimlik middleware'i YOK, kod kapısı YOK, beyan YOK`);
}

// Bilgi ekseni (bloklamaz): kaç uç kendi kapısını taşıyor
const uclar = [];
(function tara(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) tara(p);
    else if (/^route\.[tj]s$/.test(e.name)) uclar.push(p);
  }
})("app/api");
const kendi = uclar.filter((f) => KAPI_IZI.test(readFileSync(f, "utf8"))).length;
console.log(`\n  ℹ️  ${uclar.length} uçtan ${kendi}'i kendi kimlik kontrolünü taşıyor · ${uclar.length - kendi}'i KENARA güveniyor`);
console.log("  ⚠️  Kenarın gerçekten kapattığı BU KAPIYLA ÖLÇÜLMEZ — canlıya karşı ayrıca ölçülür.");

console.log(`\n─── ${sayac} router · ${yetim} açık ───`);
if (yetim) { console.log("\n⛔ Kimlik middleware'i olmayan bir router'ın kod kapısı da beyanı da yok."); process.exit(1); }
