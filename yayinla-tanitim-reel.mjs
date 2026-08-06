// Kurumsal Tanıtım Reel'i — Instagram Reels + Facebook Video yayını (4 dil: EN·FR·AR·RU).
// Asaf'ın AÇIK onayıyla çalıştırılır (toplu gönderim kuralı). TR sosyalde YOK (SOSYAL_DILLER).
// Kullanım: node yayinla-tanitim-reel.mjs [--dene]   (--dene → hiçbir şey göndermez, sadece listeler)
import { readFile } from 'node:fs/promises';

// .env.local yükle (Next dışında çalıştığımız için elle)
try {
  const env = await readFile(new URL('./.env.local', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#') || !s.includes('=')) continue;
    const i = s.indexOf('=');
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* env yoksa aşağıdaki kontrol yakalar */ }

const { publishInstagramReel, publishFacebookVideo } = await import('./lib/meta-publish.js');

const BASE = 'https://processturk.com/tanitim';

const POSTS = [
  {
    lang: 'EN',
    videoUrl: `${BASE}/reel-en-9x16.mp4`,
    caption: `From a production idea to a working factory. 🏭

ProcessTürk designs, manufactures, installs and commissions complete production lines — tomato paste, sauces, dairy, fruit juice, filling & packaging — plus fully custom turnkey projects.

One partner, end to end. Active in 27+ countries.

👉 processturk.com
#ProcessTurk #TurnkeyPlant #FoodProcessing #ProductionLine #IndustrialEngineering`,
  },
  {
    lang: 'FR',
    videoUrl: `${BASE}/reel-fr-9x16.mp4`,
    caption: `D'une idée de production à une usine en marche. 🏭

ProcessTürk conçoit, fabrique, installe et met en service des lignes de production complètes — concentré de tomate, sauces, produits laitiers, jus de fruits, remplissage & conditionnement — ainsi que des projets clés en main sur mesure.

Un seul partenaire, de A à Z. Actif dans plus de 27 pays.

👉 processturk.com
#ProcessTurk #UsineCleEnMain #Agroalimentaire #LigneDeProduction #IngenierieIndustrielle`,
  },
  {
    lang: 'AR',
    videoUrl: `${BASE}/reel-ar-9x16.mp4`,
    caption: `من فكرة الإنتاج إلى مصنع يعمل. 🏭

بروسِس تُورك تصمّم وتصنّع وتركّب وتشغّل خطوط إنتاج متكاملة — معجون الطماطم، الصلصات، الألبان، عصائر الفاكهة، التعبئة والتغليف — إضافة إلى مشاريع خاصة جاهزة للتشغيل.

شريك واحد من البداية إلى النهاية. نعمل في أكثر من ٢٧ دولة.

👉 processturk.com
#ProcessTurk #مصانع_جاهزة #الصناعات_الغذائية #خطوط_إنتاج #الهندسة_الصناعية`,
  },
  {
    lang: 'RU',
    videoUrl: `${BASE}/reel-ru-9x16.mp4`,
    caption: `От идеи производства до работающего завода. 🏭

ProcessTürk проектирует, изготавливает, монтирует и запускает полные производственные линии — томатная паста, соусы, молочная переработка, соки, розлив и упаковка — а также индивидуальные проекты под ключ.

Один партнёр от и до. Работаем более чем в 27 странах.

👉 processturk.com
#ProcessTurk #ЗаводПодКлюч #ПищевоеПроизводство #ПроизводственнаяЛиния #Инжиниринг`,
  },
];

const DENE = process.argv.includes('--dene');
const sonuc = [];

for (const p of POSTS) {
  for (const platform of ['instagram', 'facebook']) {
    const etiket = `${p.lang} → ${platform}`;
    if (DENE) { console.log(`[DENEME] ${etiket}  ${p.videoUrl}`); continue; }
    try {
      process.stdout.write(`→ ${etiket} ... `);
      const r = platform === 'instagram'
        ? await publishInstagramReel({ videoUrl: p.videoUrl, caption: p.caption })
        : await publishFacebookVideo({ videoUrl: p.videoUrl, caption: p.caption });
      const id = r?.id || r?.post_id || JSON.stringify(r).slice(0, 80);
      console.log(`✓ ${id}`);
      sonuc.push({ etiket, ok: true, id });
    } catch (e) {
      console.log(`✗ ${e.message}`);
      sonuc.push({ etiket, ok: false, hata: e.message });
    }
  }
}

if (!DENE) {
  console.log('\n═══ ÖZET ═══');
  for (const s of sonuc) console.log(`  ${s.ok ? '✓' : '✗'} ${s.etiket}${s.ok ? ` → ${s.id}` : ` → ${s.hata}`}`);
  console.log(`\nBaşarılı: ${sonuc.filter((s) => s.ok).length}/${sonuc.length}`);
}
