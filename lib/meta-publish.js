// Meta Graph API ile GERÇEK organik yayın: Instagram (Reels) + Facebook (Page video).
// Token + ID'ler .env.local'dan (META_ACCESS_TOKEN, META_PAGE_ID, META_IG_BUSINESS_ID).
// Tüm çağrılar onay kapısından SONRA /api/publish üzerinden tetiklenir.

const VER = process.env.META_API_VERSION || 'v21.0';
const BASE = `https://graph.facebook.com/${VER}`;

function token() {
  const t = process.env.META_ACCESS_TOKEN;
  if (!t) throw new Error('META_ACCESS_TOKEN tanımlı değil (.env.local).');
  return t;
}

async function graphPost(path, params, accessToken) {
  const body = new URLSearchParams({ ...params, access_token: accessToken || token() });
  const res = await fetch(`${BASE}/${path}`, { method: 'POST', body });
  const data = await res.json();
  if (data.error) throw new Error(`${data.error.message} (code ${data.error.code})`);
  return data;
}

// Facebook Page gönderimi (foto/video) KULLANICI token'ıyla yapılamaz → "(#200) publish_actions
// deprecated" hatası verir. Page'e yazmak için PAGE access token gerekir; bunu kullanıcı
// token'ından /{page}?fields=access_token ile çekeriz (token pages_manage_posts/pages_show_list
// içermeli). Süreç içi cache'lenir.
let _pageTokenCache = null;
async function pageAccessToken() {
  if (_pageTokenCache) return _pageTokenCache;
  const page = process.env.META_PAGE_ID;
  if (!page) throw new Error('META_PAGE_ID tanımlı değil.');
  const data = await graphGet(page, 'access_token');
  if (!data.access_token) {
    throw new Error('Sayfa erişim token alınamadı (kullanıcı token pages_manage_posts/pages_show_list içermeli).');
  }
  _pageTokenCache = data.access_token;
  return _pageTokenCache;
}

async function graphGet(path, fields) {
  const url = `${BASE}/${path}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token())}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`${data.error.message} (code ${data.error.code})`);
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Instagram Reels: container oluştur → işlenmesini bekle → yayınla ──
// coverUrl (opsiyonel): reel'in grid/feed kapağı. Verilmezse Instagram videodan
// otomatik kare seçer — bu genelde reel'in boş navy açılış/CTA karesi oluyor ve
// grid'i tekdüze/spam gösteriyor (Asaf 2026-07-24 tespiti). Verilince markalı
// 9:16 kapak (public/hat-video/<slug>/reel-cover-<dil>.jpg) grid'de görünür.
// Meta cover_url'i yayın anında çeker → JPEG + herkese açık HTTPS olmalı.
export async function publishInstagramReel({ videoUrl, caption, coverUrl }) {
  const ig = process.env.META_IG_BUSINESS_ID;
  if (!ig) throw new Error('META_IG_BUSINESS_ID tanımlı değil.');
  if (!videoUrl) throw new Error('Instagram Reels için video gerekli.');

  // 1) container
  const container = await graphPost(`${ig}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption: caption || '',
    share_to_feed: 'true',
    ...(coverUrl ? { cover_url: coverUrl } : {}),
  });
  const creationId = container.id;

  // 2) işlenme durumu (FINISHED olana kadar; reels birkaç dk sürebilir)
  let status = 'IN_PROGRESS';
  for (let i = 0; i < 30 && status !== 'FINISHED'; i++) {
    await sleep(5000);
    const s = await graphGet(creationId, 'status_code');
    status = s.status_code;
    if (status === 'ERROR') throw new Error('Instagram video işleme hatası (ERROR).');
  }
  if (status !== 'FINISHED') throw new Error('Instagram video zamanında işlenmedi (timeout). Birazdan tekrar deneyin.');

  // 3) yayınla
  const pub = await graphPost(`${ig}/media_publish`, { creation_id: creationId });
  return { platform: 'instagram', mediaId: pub.id, permalink: null };
}

// ── Facebook Page video ──
export async function publishFacebookVideo({ videoUrl, caption }) {
  const page = process.env.META_PAGE_ID;
  if (!page) throw new Error('META_PAGE_ID tanımlı değil.');
  if (!videoUrl) throw new Error('Facebook video yayını için video gerekli.');
  const pageTok = await pageAccessToken();
  const data = await graphPost(`${page}/videos`, { file_url: videoUrl, description: caption || '' }, pageTok);
  return { platform: 'facebook', mediaId: data.id, permalink: null };
}

// ── Instagram Fotoğraf: container oluştur → yayınla ──
export async function publishInstagramPhoto({ imageUrl, caption }) {
  const ig = process.env.META_IG_BUSINESS_ID;
  if (!ig) throw new Error('META_IG_BUSINESS_ID tanımlı değil.');
  if (!imageUrl) throw new Error('Instagram fotoğraf yayını için imageUrl gerekli.');

  const container = await graphPost(`${ig}/media`, {
    image_url: imageUrl,
    caption: caption || '',
  });
  const pub = await graphPost(`${ig}/media_publish`, { creation_id: container.id });
  return { platform: 'instagram', mediaId: pub.id, permalink: null, type: 'photo' };
}

// ── Facebook Page fotoğraf ──
export async function publishFacebookPhoto({ imageUrl, caption }) {
  const page = process.env.META_PAGE_ID;
  if (!page) throw new Error('META_PAGE_ID tanımlı değil.');
  if (!imageUrl) throw new Error('Facebook fotoğraf yayını için imageUrl gerekli.');
  const pageTok = await pageAccessToken();
  const data = await graphPost(`${page}/photos`, { url: imageUrl, caption: caption || '' }, pageTok);
  return { platform: 'facebook', mediaId: data.id, permalink: null, type: 'photo' };
}

export async function publishMeta(platform, { videoUrl, caption }) {
  if (platform === 'instagram') return publishInstagramReel({ videoUrl, caption });
  if (platform === 'facebook') return publishFacebookVideo({ videoUrl, caption });
  throw new Error(`publishMeta desteklemiyor: ${platform}`);
}

// imageUrl varsa fotoğraf, yoksa video yayınla
export async function publishMetaAuto(platform, { imageUrl, videoUrl, caption }) {
  if (imageUrl) {
    if (platform === 'instagram') return publishInstagramPhoto({ imageUrl, caption });
    if (platform === 'facebook') return publishFacebookPhoto({ imageUrl, caption });
  }
  return publishMeta(platform, { videoUrl, caption });
}
