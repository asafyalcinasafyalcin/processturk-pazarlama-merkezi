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

async function graphPost(path, params) {
  const body = new URLSearchParams({ ...params, access_token: token() });
  const res = await fetch(`${BASE}/${path}`, { method: 'POST', body });
  const data = await res.json();
  if (data.error) throw new Error(`${data.error.message} (code ${data.error.code})`);
  return data;
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
export async function publishInstagramReel({ videoUrl, caption }) {
  const ig = process.env.META_IG_BUSINESS_ID;
  if (!ig) throw new Error('META_IG_BUSINESS_ID tanımlı değil.');
  if (!videoUrl) throw new Error('Instagram Reels için video gerekli.');

  // 1) container
  const container = await graphPost(`${ig}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption: caption || '',
    share_to_feed: 'true',
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
  // Sayfa erişim token'ı gerekir; kullanıcı token'ı pages_manage_posts ile çoğu durumda yeterli.
  const data = await graphPost(`${page}/videos`, { file_url: videoUrl, description: caption || '' });
  return { platform: 'facebook', mediaId: data.id, permalink: null };
}

export async function publishMeta(platform, { videoUrl, caption }) {
  if (platform === 'instagram') return publishInstagramReel({ videoUrl, caption });
  if (platform === 'facebook') return publishFacebookVideo({ videoUrl, caption });
  throw new Error(`publishMeta desteklemiyor: ${platform}`);
}
