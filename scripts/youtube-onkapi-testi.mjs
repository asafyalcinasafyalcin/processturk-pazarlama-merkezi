#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// YOUTUBE ÖN-KAPI TESTİ — "kanal kanıtlanmadan tek byte yüklenmez."
//
// NEDEN VAR (2026-08-29): `publishYouTube`'un kanal denetimi yüklemeden SONRA
// koşuyordu ve ölçemediğinde yalnız `console.error` basıp BAŞARI dönüyordu.
// Kurumsal Web Sitesi'nde aynı mimari kusurun bedeli ölçüldü: 22–25 Ağustos'ta
// 8 video marka kanalı yerine kişisel kanala HERKESE AÇIK yüklendi.
//
// Bu test `fetch`i stub'lar — GERÇEK yükleme YAPILMAZ, hiçbir video oluşmaz.
//   node scripts/youtube-onkapi-testi.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { publishYouTube } from '../lib/tiktok-youtube-publish.js';

let gecti = 0; const hata = [];
const bekle = (ad, kosul) => { if (kosul) gecti++; else hata.push(ad); };

process.env.GOOGLE_CLIENT_ID = 'test';
process.env.GOOGLE_CLIENT_SECRET = 'test';
process.env.GOOGLE_REFRESH_TOKEN = 'test';
process.env.YOUTUBE_CHANNEL_ID = 'UCgQ-DOGRU';

const gercekFetch = globalThis.fetch;
const cevap = (status, body) => ({ ok: status >= 200 && status < 300, status,
  json: async () => body, headers: { get: () => null } });

// Yükleme uçlarına gidilirse test DÜŞER — ön-kapı oraya varmamalı.
let yuklemeDenendi = false;
const kur = (kanalCevabi) => {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('oauth2.googleapis.com/token')) return cevap(200, { access_token: 'at', expires_in: 3599 });
    if (u.includes('youtube/v3/channels')) return kanalCevabi();
    yuklemeDenendi = true;                       // ⛔ buraya gelinmemeli
    return cevap(200, { id: 'OLMAMALI' });
  };
};

const dusmeli = async (ad, kanalCevabi, desen) => {
  yuklemeDenendi = false;
  kur(kanalCevabi);
  let mesaj = '';
  try { await publishYouTube({ videoUrl: 'https://ornek/x.mp4', caption: 'c', title: 't' }); }
  catch (e) { mesaj = e.message; }
  bekle(`${ad} → yükleme DENENMEDİ`, yuklemeDenendi === false);
  bekle(`${ad} → hata fırlattı`, mesaj !== '');
  if (desen) bekle(`${ad} → sebebi adıyla söyledi`, desen.test(mesaj));
};

await dusmeli('① dar kapsam (403)',
  () => cevap(403, { error: { errors: [{ reason: 'insufficientPermissions' }] } }), /youtube\.readonly/);
await dusmeli('② YANLIŞ kanal',
  () => cevap(200, { items: [{ id: 'UCGJQtm-YANLIS' }] }), /YANLIŞ KANAL/);
await dusmeli('③ API kapalı',
  () => cevap(200 - 200 + 403, { error: { errors: [{ reason: 'accessNotConfigured' }] } }), /KAPALI/);
// ⚠️ Desen Türkçe EKE dayanmamalı: mesaj 'kanalı YOK' der, `/kanal YOK/` eşleşmez.
//    Aynı tuzak bugün web sitesi tarafında da yakalandı ('kanal' vs 'kanalı').
await dusmeli('④ hesapta kanal yok', () => cevap(200, { items: [] }), /kanal[ıi]? YOK/);
await dusmeli('⑤ ağ hatası (fail-closed)', () => { throw new Error('ENOTFOUND'); }, /YÜKLENMEDİ/);

// ⑥ DOĞRU kanal → kapı geçer ve yüklemeye İZİN verir (kapı her şeyi kapatmıyor).
yuklemeDenendi = false;
kur(() => cevap(200, { items: [{ id: 'UCgQ-DOGRU' }] }));
try { await publishYouTube({ videoUrl: 'https://ornek/x.mp4', caption: 'c', title: 't' }); } catch { /* indirme stub'ı sonrası kopabilir */ }
bekle('⑥ DOĞRU kanal → yüklemeye geçildi', yuklemeDenendi === true);

// ── KAYITLI KANIT (2026-08-29) ──────────────────────────────────────────────
// Dar kapsamlı jetonda kanal, jetonun KENDİ yükleme cevabından bir kez ölçülüp
// kaydedilebilir. Kanıt JETONA BAĞLIDIR — jeton değişirse kendiliğinden düşer.
import { createHash } from 'node:crypto';
const izOf = (t) => createHash('sha256').update(t).digest('hex').slice(0, 12);
const darKapsam = () => cevap(403, { error: { errors: [{ reason: 'insufficientPermissions' }] } });
const dogruIz = izOf(process.env.GOOGLE_REFRESH_TOKEN);

// ⑦ Geçerli kanıt → dar kapsamda bile yüklemeye izin verilir.
process.env.YOUTUBE_KANAL_KANITI = `${dogruIz}:UCgQ-DOGRU:2026-08-29`;
yuklemeDenendi = false; kur(darKapsam);
try { await publishYouTube({ videoUrl: 'https://ornek/x.mp4', caption: 'c', title: 't' }); } catch { /* stub */ }
bekle('⑦ geçerli KAYITLI kanıt → yüklemeye geçildi', yuklemeDenendi === true);

// ⑧ Kanıt BAŞKA jetona aitse yok sayılır (fail-closed korunur).
process.env.YOUTUBE_KANAL_KANITI = `baskajeton00:UCgQ-DOGRU:2026-08-29`;
await dusmeli('⑧ kanıt BAŞKA jetona ait', darKapsam, /KAYITLI kanıt da yok/);

// ⑨ Kanıt YANLIŞ kanal diyorsa yok sayılır.
process.env.YOUTUBE_KANAL_KANITI = `${dogruIz}:UCGJQtm-YANLIS:2026-08-29`;
await dusmeli('⑨ kanıt YANLIŞ kanal diyor', darKapsam, /KAYITLI kanıt da yok/);

// ⑩ Bozuk biçim yok sayılır.
process.env.YOUTUBE_KANAL_KANITI = 'sacma';
await dusmeli('⑩ kanıt biçimi bozuk', darKapsam, /KAYITLI kanıt da yok/);
delete process.env.YOUTUBE_KANAL_KANITI;

globalThis.fetch = gercekFetch;
console.log(`\nYOUTUBE ÖN-KAPI: ${gecti} GEÇTİ · ${hata.length} KALDI`);
if (hata.length) { for (const h of hata) console.log('  ❌', h); process.exit(1); }
console.log('✅ Kanal kanıtlanmadan yükleme başlamıyor; kanıtlanınca engellemiyor.\n');
