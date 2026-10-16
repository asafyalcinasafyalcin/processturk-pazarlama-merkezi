#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// YOUTUBE KAPAK TESTİ — "kapak hatası yayını asla geri almaz, ama sessiz de kalmaz."
//
// `setYouTubeThumbnail` video yayınlandıktan SONRA koşar. Fırlatırsa panel yayını
// başarısız sanıp tekrar dener ve aynı video ikinci kez yüklenir. Bu test `fetch`i
// stub'lar — GERÇEK istek YAPILMAZ.
//   node scripts/youtube-kapak-testi.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { setYouTubeThumbnail } from '../lib/tiktok-youtube-publish.js';

let gecti = 0; const hata = [];
const bekle = (ad, kosul) => { if (kosul) gecti++; else hata.push(ad); };

process.env.GOOGLE_CLIENT_ID = 'test';
process.env.GOOGLE_CLIENT_SECRET = 'test';
process.env.GOOGLE_REFRESH_TOKEN = 'test';

const gercekFetch = globalThis.fetch;
const yanit = (status, { body = {}, tur = 'application/json', bayt = 10 } = {}) => ({
  ok: status >= 200 && status < 300, status,
  json: async () => body,
  arrayBuffer: async () => new ArrayBuffer(bayt),
  headers: { get: (k) => (k.toLowerCase() === 'content-type' ? tur : null) },
});

let setCagrildi = 0;
const kur = ({ kapak, set, firlat = false }) => {
  setCagrildi = 0;
  globalThis.fetch = async (url) => {
    if (firlat) throw new Error('ağ koptu');
    if (String(url).includes('oauth2.googleapis.com')) return yanit(200, { body: { access_token: 'tok' } });
    if (String(url).includes('/thumbnails/set')) { setCagrildi++; return set; }
    return kapak;
  };
};

const vaka = async (ad, kurulum, girdi, kontrol) => {
  kur(kurulum);
  let sonuc, firlatti = false;
  try { sonuc = await setYouTubeThumbnail(girdi); } catch { firlatti = true; }
  bekle(`${ad}: fırlatmadı`, !firlatti);
  if (!firlatti) kontrol(sonuc);
};

const G = { videoId: 'abc', thumbnailUrl: 'https://processturk.com/site-tanitim/kapak-en-yt.jpg' };

await vaka('kapak yok', {}, { videoId: 'abc', thumbnailUrl: '' },
  (s) => { bekle('kapak yok → atlandi', s.durum === 'atlandi'); bekle('kapak yok → YouTube çağrılmadı', setCagrildi === 0); });
await vaka('başarılı', { kapak: yanit(200, { tur: 'image/jpeg' }), set: yanit(200) }, G,
  (s) => { bekle('200 → kondu', s.durum === 'kondu'); bekle('200 → set 1 kez', setCagrildi === 1); });
await vaka('kanal doğrulanmamış', { kapak: yanit(200, { tur: 'image/jpeg' }),
  set: yanit(403, { body: { error: { message: 'custom thumbnails not allowed', errors: [{ reason: 'forbidden' }] } } }) }, G,
  (s) => { bekle('403 → basarisiz', s.durum === 'basarisiz'); bekle('403 → sebep adıyla', /403/.test(s.not) && /forbidden/.test(s.not)); });
await vaka('kapak indirilemedi', { kapak: yanit(404) }, G,
  (s) => { bekle('404 → basarisiz', s.durum === 'basarisiz'); bekle('404 → YouTube çağrılmadı', setCagrildi === 0); });
await vaka('kapak HTML döndü', { kapak: yanit(200, { tur: 'text/html' }) }, G,
  (s) => { bekle('html → basarisiz', s.durum === 'basarisiz'); bekle('html → YouTube çağrılmadı', setCagrildi === 0); });
await vaka('kapak 2 MB üstü', { kapak: yanit(200, { tur: 'image/jpeg', bayt: 2 * 1024 * 1024 + 1 }) }, G,
  (s) => { bekle('2MB+ → basarisiz', s.durum === 'basarisiz'); bekle('2MB+ → YouTube çağrılmadı', setCagrildi === 0); });
await vaka('ağ koptu', { firlat: true }, G,
  (s) => { bekle('ağ hatası → basarisiz', s.durum === 'basarisiz'); });

globalThis.fetch = gercekFetch;
console.log(`\nYOUTUBE KAPAK: ${gecti} GEÇTİ · ${hata.length} KALDI`);
for (const h of hata) console.log('  🔴 ' + h);
process.exit(hata.length ? 1 : 0);
