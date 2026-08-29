// TikTok Content Publishing API + YouTube Data API v3 entegrasyonu.
// Credentials ortam değişkenlerinden okunur. Eksikse assisted fallback döner.
// Marka adı brand.js'ten (BRAND.name) — BRAND_ID yoksa ProcessTürk varsayılanı.
//
// TikTok gerekli: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_ACCESS_TOKEN, TIKTOK_OPEN_ID
// YouTube gerekli: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, YOUTUBE_CHANNEL_ID
import { BRAND } from './brand.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Token yenileme yardımcıları ─────────────────────────────────────────────

async function refreshTikTokToken() {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: process.env.TIKTOK_REFRESH_TOKEN || '',
    }),
  });
  const d = await res.json();
  if (d.error?.code && d.error.code !== 'ok') throw new Error(`TikTok token yenileme: ${d.error.message}`);
  return d.data?.access_token || process.env.TIKTOK_ACCESS_TOKEN;
}

async function getGoogleAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const d = await res.json();
  if (d.error) throw new Error(`Google token: ${d.error_description || d.error}`);
  return d.access_token;
}

// ── TikTok organik video yayını ─────────────────────────────────────────────
// TikTok Content Publishing API v2: video URL'den direkt publish
export async function publishTikTok({ videoUrl, caption }) {
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_ACCESS_TOKEN) {
    throw new Error('TikTok credentials eksik (TIKTOK_CLIENT_KEY, TIKTOK_ACCESS_TOKEN)');
  }
  if (!videoUrl) throw new Error('TikTok için videoUrl zorunlu.');

  const token = await refreshTikTokToken().catch(() => process.env.TIKTOK_ACCESS_TOKEN);
  const openId = process.env.TIKTOK_OPEN_ID;
  if (!openId) throw new Error('TIKTOK_OPEN_ID eksik.');

  const body = {
    post_info: {
      title: caption?.slice(0, 150) || '',
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
    },
    source_info: {
      source: 'PULL_FROM_URL',
      video_url: videoUrl,
    },
  };

  const res = await fetch(`https://open.tiktokapis.com/v2/post/publish/video/init/?open_id=${openId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await res.json();
  if (d.error?.code && d.error.code !== 'ok') throw new Error(`TikTok yayın: ${d.error.message}`);

  const publishId = d.data?.publish_id;
  return { platform: 'tiktok', publishId };
}

// ── YouTube video yükle ve yayınla ──────────────────────────────────────────
/**
 * @param {object} o
 * @param {string} o.videoUrl  indirilecek mp4
 * @param {string} [o.caption] açıklama
 * @param {string} [o.title]   başlık
 * @param {'public'|'unlisted'|'private'} [o.privacy='public']
 *   ⚠️ Varsayılan `public` — mevcut çağıranların davranışı BİREBİR korunur.
 *   `unlisted`, "önce ben bakayım" akışı içindir: linki bilen görür, kanalda listelenmez,
 *   arama sonuçlarına düşmez. Geri alınabilir tek adımdır (Asaf kararı 23.08.2026).
 */
/**
 * 🔴 YÜKLEME ÖNCESİ KANAL KAPISI (2026-08-29) — FAIL-CLOSED.
 *
 * NEDEN: aşağıdaki kanal denetimi yüklemeden SONRA koşuyordu ve ölçemediğinde
 * (`olculemedi`) yalnız `console.error` basıp **başarı dönüyordu**. Yani kapı,
 * korumak istediği tek şeyi — videonun yanlış kanala gitmesini — engellemiyordu.
 *
 * Bedeli Kurumsal Web Sitesi tarafında ölçüldü: 22–25 Ağustos arasında **8 video**
 * ProcessTürk marka kanalı yerine kişisel kanala (`UCGJQtm-…`) HERKESE AÇIK yüklendi.
 * Aynı mimari kusur bu dosyada da vardı; buradan da yüklenebilirdi.
 *
 * ⛔ Artık: kanal KANITLANMADAN tek byte yüklenmez. "Ölçemedim" bir GEÇTİ değildir.
 * ⚠️ `youtube.upload` TEK BAŞINA `channels.list` çağıramaz (403 insufficientPermissions).
 *    Jeton `youtube.upload` + `youtube.readonly` ile alınmalıdır — bu, kapının
 *    çalışabilmesinin ÖN KOŞULUDUR, opsiyonel bir iyileştirme değil.
 */
async function kanalDogrulaOnce(accessToken, beklenenKanal) {
  let r;
  try {
    r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
                    { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch (e) {
    throw new Error(`YouTube kanal doğrulaması ağ hatası (${e.message}) — video YÜKLENMEDİ.`);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const sebep = j.error?.errors?.[0]?.reason || '';
    if (sebep === 'insufficientPermissions' || r.status === 401) {
      throw new Error(
        'YouTube kanalı DOĞRULANAMADI — jeton yalnız `youtube.upload` kapsamıyla alınmış, '
        + '`channels.list` çağıramıyor. Doğrulanamayan kanala yükleme YAPILMAZ. '
        + 'Çözüm: refresh token `youtube.upload` + `youtube.readonly` ile YENİDEN alınmalı.');
    }
    if (sebep === 'accessNotConfigured') {
      throw new Error('YouTube Data API v3 bu Google projesinde KAPALI — API Library\'den etkinleştirin.');
    }
    throw new Error(`YouTube kanal doğrulaması ${r.status} · ${sebep} ${(j.error?.message || '').slice(0, 140)}`);
  }
  const gercek = j.items?.[0]?.id;
  if (!gercek) throw new Error('Yetkilenen Google hesabında YouTube kanalı YOK — video yüklenmedi.');
  if (gercek !== beklenenKanal) {
    throw new Error(
      `YouTube YANLIŞ KANAL — jeton ${gercek} kanalı için yetkilendirilmiş, beklenen ${beklenenKanal}. `
      + 'Video YÜKLENMEDİ (kapı yüklemeden önce durdurdu). Düzeltmesi kod değil YETKİLENDİRMEDİR: '
      + 'OAuth Playground\'da izin verirken hesap seçiciden MARKA kanalını seç.');
  }
  return gercek;
}

export async function publishYouTube({ videoUrl, caption, title, privacy = 'public' }) {
  if (!['public', 'unlisted', 'private'].includes(privacy)) {
    throw new Error(`privacy geçersiz: ${privacy}`);
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
    throw new Error('YouTube credentials eksik (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)');
  }
  if (!videoUrl) throw new Error('YouTube için videoUrl zorunlu.');

  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!channelId) throw new Error('YOUTUBE_CHANNEL_ID eksik.');

  const accessToken = await getGoogleAccessToken();

  // ⛔ ÖN-KAPI: kanal kanıtlanmadan indirme/yükleme başlamaz.
  await kanalDogrulaOnce(accessToken, channelId);

  // Video verisi URL'den indir
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`Video indirilemedi: ${videoUrl}`);
  const videoBuffer = await videoRes.arrayBuffer();
  const videoBytes = Buffer.from(videoBuffer);
  const contentType = 'video/mp4';

  // Resumable upload başlat
  const metaRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': contentType,
        'X-Upload-Content-Length': String(videoBytes.length),
      },
      body: JSON.stringify({
        snippet: {
          title: title || caption?.slice(0, 100) || BRAND.name,
          description: caption || '',
          tags: [BRAND.name, 'dolum makinesi', 'etiketleme', 'food processing', 'MadeInTurkey'],
          categoryId: '28', // Science & Technology
        },
        status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
      }),
    }
  );
  if (!metaRes.ok) {
    const err = await metaRes.text();
    throw new Error(`YouTube upload başlatılamadı: ${err}`);
  }
  const uploadUrl = metaRes.headers.get('Location');
  if (!uploadUrl) throw new Error('YouTube upload URL alınamadı.');

  // Video yükle
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Content-Length': String(videoBytes.length) },
    body: videoBytes,
  });
  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(`YouTube video yükleme: ${JSON.stringify(uploadData)}`);

  /* 🔴 SON SAVUNMA — asıl kapı artık yüklemeden ÖNCE koşuyor (`kanalDogrulaOnce`).
     Buraya normalde hiç düşülmez; yarış/hesap değişimi gibi teorik durumlar içindir.
     Tarihçe: `YOUTUBE_CHANNEL_ID` bu fonksiyonda ÖLÜ DEĞİŞKENDİ:
     okunuyor, varlığı kontrol ediliyor, sonra HİÇ kullanılmıyordu. YouTube
     `videos.insert` videoyu refresh token'ın bağlı olduğu kanala koyar; hesapta
     birden fazla kanal varsa (marka hesabı) yanlış kanala düşer ve bunu kimse
     görmez. Artık yüklemeden SONRA gerçek kanal okunur ve beklenenle karşılaştırılır.
     ⚠️ Uyumsuzluk video'yu SİLMEZ (silme geri alınamaz iştir) — adıyla bağırır;
        `unlisted` yüklemede zaten kimse görmeden düzeltilebilir. */
  /* ⚠️ Bu kapının İLK hâli ATILDI: `if (gercek && gercek !== channelId)` yazıyordu ve
     `gercek` undefined olunca SESSİZCE uyarısız geçiyordu. Ölçüldü — bizim refresh
     token'ımızın kapsamı yalnız `youtube.upload`, `videos.list` **403** veriyor. Yani
     kapı her zaman "uyarı yok" diyordu ve hiçbir şey ölçmüyordu; kapısız olmaktan
     kötüydü çünkü ölçüldüğü sanılıyordu. Üç durum artık AYRI:
       "dogrulandi" · "uyusmuyor" · "olculemedi" (+ sebep). */
  let kanalDurum = { durum: 'olculemedi', not: null };
  try {
    const kres = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${uploadData.id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } });
    const kd = await kres.json();
    if (kd.error) {
      kanalDurum = { durum: 'olculemedi',
        not: `okuma yetkisi yok (${kd.error.status || kd.error.code}): token kapsamı `
          + `yalnız upload. Kanal/gizlilik DIŞARIDAN doğrulanmalı — kanalın herkese `
          + `açık RSS akışında (feeds/videos.xml?channel_id=…) unlisted video GÖRÜNMEZ.` };
    } else {
      const gercek = kd.items?.[0]?.snippet?.channelId;
      const gerceklikGizlilik = kd.items?.[0]?.status?.privacyStatus;
      if (!gercek) {
        kanalDurum = { durum: 'olculemedi', not: 'API kayıt döndürmedi (işleniyor olabilir)' };
      } else if (gercek !== channelId) {
        kanalDurum = { durum: 'uyusmuyor',
          not: `video ${gercek} kanalına düştü, beklenen ${channelId}` };
      } else {
        kanalDurum = { durum: 'dogrulandi', not: `gizlilik=${gerceklikGizlilik}` };
      }
    }
  } catch (e) {
    kanalDurum = { durum: 'olculemedi', not: e.message };
  }
  if (kanalDurum.durum !== 'dogrulandi') {
    console.error(`${kanalDurum.durum === 'uyusmuyor' ? '🔴 YANLIŞ KANAL' : '⚠️ kanal ATLANDI'}`
      + `: ${kanalDurum.not}`);
  }

  return { platform: 'youtube', videoId: uploadData.id, privacy,
    url: `https://youtu.be/${uploadData.id}`, kanal: kanalDurum };
}

// ── Credentials kontrolü ────────────────────────────────────────────────────
export function tiktokConfigured() {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_OPEN_ID);
}

export function youtubeConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN && process.env.YOUTUBE_CHANNEL_ID);
}
