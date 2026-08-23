#!/usr/bin/env node
/**
 * MAKİNE FİLMLERİNİ YOUTUBE'A YAYINLAR — herkese açık.
 *
 * Asaf kararı (23.08.2026): *"liste dışı olmasın direkt ekleyebilirsin yayına alabilirsin"*.
 *
 * ⚠️ KOTA GERÇEK BİR SINIR: `videos.insert` **1600 birim**, varsayılan günlük tavan
 *    **10.000** → günde ~6 yükleme. Bu yüzden script kotayı SAYAR, aşınca DURUR ve
 *    kalanları adıyla listeler. Sessizce yarıda kesilen bir yayın, "hepsi yüklendi"
 *    sanılan bir yayından iyidir.
 *
 * ⛔ GİZLİLİK API'DEN DEĞİŞTİRİLEMİYOR: token kapsamı yalnız `youtube.upload`;
 *    `videos.update` **403** veriyor (ölçüldü). Bu yüzden video DOĞRUDAN `public`
 *    yüklenir — sonradan çevirmek mümkün değil.
 *
 * ⛔ METİN UYDURULMAZ: başlık/açıklama `Processturk_Remotion_Studio` sosyal metin
 *    defterinden gelir ve o defter kendi kapısından geçmiştir.
 *
 *   node --env-file=.env.local scripts/youtube-makine-yayinla.mjs <defter.json> \
 *        [--dil en] [--tavan 5] [--kuru]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { publishYouTube, youtubeConfigured } from "../lib/tiktok-youtube-publish.js";

const argv = process.argv.slice(2);
const bayrak = (a, v) => { const i = argv.indexOf(a); return i >= 0 ? argv[i + 1] : v; };
const defterYolu = argv.find((a) => !a.startsWith("--") && a.endsWith(".json"));
const dil = bayrak("--dil", "en");
const tavan = Number(bayrak("--tavan", "5"));
const kuru = argv.includes("--kuru");
const KAYIT = "outputs/youtube-yayin-kaydi.json";

if (!defterYolu) { console.error("kullanım: … <sosyal-metinler-*.json> [--dil en] [--tavan 5]"); process.exit(2); }
if (!youtubeConfigured()) { console.error("🔴 DUR — YouTube kimlikleri eksik."); process.exit(1); }

const kayitlar = JSON.parse(readFileSync(defterYolu, "utf8")).filter((k) => k.dil === dil);
// ⛔ MÜKERRER YÜKLEME KAPISI — aynı videoyu iki kez yüklemek kanalı kirletir ve
//    kotayı boşa harcar. Yüklenenler kalıcı deftere yazılır.
const gecmis = existsSync(KAYIT) ? JSON.parse(readFileSync(KAYIT, "utf8")) : {};
const bekleyen = kayitlar.filter((k) => !gecmis[`${k.slug}/${k.dil}`]);

console.log(`${kayitlar.length} kayıt (${dil}) · ${kayitlar.length - bekleyen.length} zaten yüklü `
  + `· ${bekleyen.length} bekliyor · bu koşumda en çok ${tavan}`);
if (kuru) {
  for (const k of bekleyen.slice(0, tavan)) console.log(`   ▶ ${k.slug}  ${k.youtube?.title}`);
  console.log("\n[kuru] yükleme yapılmadı");
  process.exit(0);
}

const yuklenen = []; const dusen = [];
for (const k of bekleyen.slice(0, tavan)) {
  const url = k.filmUrl ?? k.reelUrl;
  if (!url || !k.youtube?.title) { dusen.push([k.slug, "metin/medya eksik"]); continue; }
  try {
    const r = await publishYouTube({
      videoUrl: url, title: k.youtube.title, caption: k.youtube.description,
      privacy: "public",
    });
    gecmis[`${k.slug}/${k.dil}`] = { videoId: r.videoId, url: r.url, dil: k.dil };
    yuklenen.push([k.slug, r.url]);
    console.log(`  ✓ ${k.slug.padEnd(28)} ${r.url}`);
  } catch (e) {
    const kota = /quota/i.test(e.message);
    dusen.push([k.slug, kota ? "KOTA DOLDU" : e.message.slice(0, 110)]);
    console.log(`  ✗ ${k.slug.padEnd(28)} ${kota ? "🔴 KOTA DOLDU — durduruldu" : e.message.slice(0, 110)}`);
    if (kota) break;                       // kota bitince devam etmek anlamsız
  }
}
writeFileSync(KAYIT, JSON.stringify(gecmis, null, 2) + "\n");

console.log(`\nSONUÇ: ${yuklenen.length} yüklendi · ${dusen.length} düştü`);
for (const [s, n] of dusen) console.log(`  🔴 ${s}: ${n}`);
const kalan = bekleyen.length - yuklenen.length;
if (kalan > 0) console.log(`⏳ ${kalan} kayıt BEKLİYOR — scripti tekrar koş (kota günlük yenilenir).`);
console.log(`→ ${KAYIT}`);
console.log("⛔ Her video ayrıca DIŞARIDAN doğrulanır: scripts/youtube-yayin-kapisi.mjs <id> --bekle public");
