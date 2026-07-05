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
export async function publishYouTube({ videoUrl, caption, title }) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
    throw new Error('YouTube credentials eksik (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)');
  }
  if (!videoUrl) throw new Error('YouTube için videoUrl zorunlu.');

  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!channelId) throw new Error('YOUTUBE_CHANNEL_ID eksik.');

  const accessToken = await getGoogleAccessToken();

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
        status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
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

  return { platform: 'youtube', videoId: uploadData.id, url: `https://youtu.be/${uploadData.id}` };
}

// ── Credentials kontrolü ────────────────────────────────────────────────────
export function tiktokConfigured() {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_OPEN_ID);
}

export function youtubeConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN && process.env.YOUTUBE_CHANNEL_ID);
}
