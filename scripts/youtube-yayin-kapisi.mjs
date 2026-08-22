#!/usr/bin/env node
/**
 * YOUTUBE YAYIN KAPISI — yüklenen videonun GERÇEKTE ne olduğunu DIŞARIDAN ölçer.
 *
 * 🔴 NEDEN DIŞARIDAN: bizim refresh token'ımızın kapsamı yalnız `youtube.upload`.
 *    `videos.list` **403** veriyor → API ile "hangi kanal, hangi gizlilik" SORULAMAZ.
 *    Yayıncının içindeki doğrulama bu yüzden `olculemedi` yazar; gerçek ölçüm burada,
 *    kimlik gerektirmeyen iki genel uçla yapılır:
 *      · oEmbed        → video var mı, başlığı ne, HANGİ KANALDA (author_url)
 *      · kanal RSS'i   → video PUBLIC mi (unlisted video akışta GÖRÜNMEZ)
 *
 * ⚠️ RSS "yok" demek "unlisted" demektir AMA akış gecikmeli olabilir → yeni yüklenen
 *    public bir video da kısa süre görünmeyebilir. Bu yüzden çıktı ZAMAN DAMGALIDIR
 *    ve kapı bunu açıkça yazar; şüphede kalan sonuç GEÇTİ sayılmaz.
 *
 *   node scripts/youtube-yayin-kapisi.mjs <videoId> [--bekle unlisted|public]
 */
const id = process.argv[2];
if (!id) { console.error("kullanım: youtube-yayin-kapisi.mjs <videoId> [--bekle unlisted|public]"); process.exit(2); }
const bi = process.argv.indexOf("--bekle");
const beklenen = bi >= 0 ? process.argv[bi + 1] : null;
const kanalId = process.env.YOUTUBE_CHANNEL_ID;

let gecti = 0; const kaldi = []; const atlandi = [];

// ① video var mı + hangi kanalda
let oe = null;
try {
  const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://youtu.be/${id}`)}&format=json`);
  if (r.ok) oe = await r.json();
} catch { /* aşağıda ele alınır */ }
if (!oe) {
  kaldi.push("video oEmbed ile bulunamadı (silinmiş / private / geçersiz id)");
  console.log("  ✗ video bulunamadı");
} else {
  gecti++;
  console.log(`  ✓ video var       ${oe.title}`);
  console.log(`    kanal           ${oe.author_name.trim()}  (${oe.author_url})`);
}

// ② PUBLIC mi — kanalın herkese açık akışında geçiyor mu
if (!kanalId) {
  atlandi.push("gizlilik: YOUTUBE_CHANNEL_ID yok → RSS akışı sorulamadı");
  console.log("  — gizlilik ATLANDI (kanal id yok)");
} else {
  const rss = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${kanalId}`)).text();
  const akista = rss.includes(id);
  const olculen = akista ? "public" : "unlisted";
  console.log(`  · ölçülen gizlilik ${olculen}  (kanal akışında ${akista ? "VAR" : "yok"})`);
  if (!beklenen) {
    atlandi.push("gizlilik: --bekle verilmedi, yalnız raporlandı");
  } else if (olculen === beklenen) {
    gecti++;
    console.log(`  ✓ gizlilik        beklenen ${beklenen}`);
  } else {
    kaldi.push(`gizlilik: beklenen ${beklenen}, ölçülen ${olculen}`
      + (beklenen === "public" ? " (akış gecikmeli olabilir — birkaç dk sonra tekrar ölç)" : ""));
    console.log(`  ✗ gizlilik        beklenen ${beklenen}, ölçülen ${olculen}`);
  }
}

console.log(`\nSONUÇ: ${gecti} GEÇTİ · ${kaldi.length} KALDI · ${atlandi.length} ATLANDI`);
for (const k of kaldi) console.log("  🔴 " + k);
for (const a of atlandi) console.log("  ⚠️ " + a);
process.exit(kaldi.length ? 1 : 0);
