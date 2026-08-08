#!/usr/bin/env node
/**
 * REEL YAYINCISI — Remotion'da üretilmiş çok dilli satış reel'ini Instagram + Facebook'a verir.
 *
 * ⛔ YENİ GRAPH UYGULAMASI DEĞİLDİR. Yayın çağrıları `lib/meta-publish.js`'e gider — bu depoda
 *    bir kez yazılmış ve sertleştirilmiş tek Meta yolu odur (sayfa jetonu türetimi, REELS
 *    container + FINISHED bekleme, hata yükseltme). Envanterde bir zamanlar ÜÇ ayrı Meta Graph
 *    uygulaması vardı ve temizlendi; dördüncüsünü açmak o temizliği geri almaktır.
 *
 * ⚠️ KURU KOŞUM VARSAYILAN. `--gonder` verilmedikçe hiçbir şey yayınlanmaz — yalnız ne
 *    gideceğini basar. Yayın GERİ ALINAMAZ ve CLAUDE.md §Toplu Gönderim Onayı'na tabidir:
 *    içerik gösterilir, kanal + adet söylenir, Asaf'ın AÇIK onayı beklenir.
 *
 * ⚠️ DİLLER AYNI ANDA GÖNDERİLMEZ. `sosyal-icerik-optimize` §1: her dil ayrı gönderi, FARKLI
 *    gün/saatte. Aynı ürünün dört dilini tek seferde aynı hesaba basmak spam görünümü üretir
 *    ve erişimi düşürür. Bu yüzden script TEK DİL alır; sıralamayı çağıran yapar.
 *
 *   node scripts/reel-yayinla.mjs --metin <yol.json> --dil en                  # KURU
 *   node scripts/reel-yayinla.mjs --metin <yol.json> --dil en --gonder         # IG + FB
 *   node scripts/reel-yayinla.mjs --metin <yol.json> --dil en --kanal ig --gonder
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kok = path.join(__dirname, "..");

// .env.local — meta-publish.js process.env'den okur.
for (const satir of readFileSync(path.join(kok, ".env.local"), "utf8").split("\n")) {
  const m = satir.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { publishInstagramReel, publishFacebookVideo } = await import("../lib/meta-publish.js");

const argv = process.argv.slice(2);
const al = (bayrak, varsayilan = "") => {
  const i = argv.indexOf(bayrak);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : varsayilan;
};
const metinYolu = al("--metin");
const dil = al("--dil");
const kanal = al("--kanal", "ikisi");
const gonder = argv.includes("--gonder");

if (!metinYolu || !dil) {
  console.error("Kullanım: --metin <yol.json> --dil <en|fr|ar|ru> [--kanal ig|fb|ikisi] [--gonder]");
  process.exit(2);
}

const kayitlar = JSON.parse(readFileSync(metinYolu, "utf8"));
const k = kayitlar.find((r) => r.dil === dil);
if (!k) { console.error(`HATA: "${dil}" dili ${metinYolu} içinde yok.`); process.exit(2); }

// ⛔ VARLIK ÖNCE ÖLÇÜLÜR. Meta video_url'i UZAKTAN çeker; 404 bir URL'i göndermek container'ı
// ERROR'a düşürür ve hatayı dakikalar sonra öğrenirsin. Ölçmek bir saniye sürüyor.
async function erisilebilir(url) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.status;
  } catch { return 0; }
}

const videoDurum = await erisilebilir(k.reelUrl);
const kapakDurum = k.coverUrl ? await erisilebilir(k.coverUrl) : 0;

console.log(`\n═══ ${dil.toUpperCase()} · ${gonder ? "YAYIN" : "KURU KOŞUM"} ═══`);
console.log(`video : ${videoDurum}  ${k.reelUrl}`);
console.log(`kapak : ${kapakDurum || "—"}  ${k.coverUrl || "(yok)"}`);
console.log(`kanal : ${kanal}`);
console.log(`\n── Instagram metni ──\n${k.instagram}`);
console.log(`\n── Facebook metni ──\n${k.linkedin}`);

if (videoDurum !== 200) {
  console.error(`\n⛔ DURDU: video ${videoDurum} dönüyor. Meta bunu çekemez.`);
  process.exit(1);
}
if (!gonder) {
  console.log("\n⏸️  KURU KOŞUM — hiçbir şey gönderilmedi. Yayın için: --gonder");
  process.exit(0);
}

const sonuc = [];
if (kanal === "ig" || kanal === "ikisi") {
  process.stdout.write("\n→ Instagram Reels yayınlanıyor (işlenme birkaç dakika sürebilir)… ");
  try {
    const r = await publishInstagramReel({
      videoUrl: k.reelUrl, caption: k.instagram,
      ...(kapakDurum === 200 ? { coverUrl: k.coverUrl } : {}),
    });
    console.log(`✅ mediaId=${r.mediaId}`);
    sonuc.push({ kanal: "instagram", ok: true, mediaId: r.mediaId });
  } catch (e) {
    console.log(`❌ ${e.message}`);
    sonuc.push({ kanal: "instagram", ok: false, hata: e.message });
  }
}
if (kanal === "fb" || kanal === "ikisi") {
  process.stdout.write("→ Facebook video yayınlanıyor… ");
  try {
    // Facebook gövdesinde derin-link var → LinkedIn/Facebook metni kullanılır (kural 4).
    const r = await publishFacebookVideo({ videoUrl: k.reelUrl, caption: k.linkedin });
    console.log(`✅ mediaId=${r.mediaId}`);
    sonuc.push({ kanal: "facebook", ok: true, mediaId: r.mediaId });
  } catch (e) {
    console.log(`❌ ${e.message}`);
    sonuc.push({ kanal: "facebook", ok: false, hata: e.message });
  }
}

const basarili = sonuc.filter((s) => s.ok).length;
console.log(`\n${basarili}/${sonuc.length} kanal yayınlandı.`);
// Bir kanal düşerse çıkış kodu 1 — "kısmen gitti" sessizce başarı sayılmaz.
process.exit(basarili === sonuc.length ? 0 : 1);
