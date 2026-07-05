// Pazarlama Merkezi — minimal PWA service worker (offline kabuk + asset cache).
// Amaç: yüklenebilir PWA + hızlı ikinci açılış. Push/bildirim mimari HAZIR ama
// gerçek push (API bağlanmadan) YOK — sahte entegrasyon eklenmez.
const CACHE = 'pazarlama-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Statik asset (Next _next/static, icon) → cache-first. Diğerleri (API, sayfa) → network-first.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API'ler asla cache'lenmez (para/kredi/veri güncelliği kritik).
  if (url.pathname.startsWith('/api/')) return;

  const isStatic = url.pathname.startsWith('/_next/static') || url.pathname === '/icon.svg';
  if (isStatic) {
    e.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      }))
    );
    return;
  }

  // Sayfa gezinmesi: ağ önce, çevrimdışıysa kabuk (/) fallback.
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('/')));
  }
});

// Push iskeleti — mimari hazır; gerçek abonelik/anahtar sonraki fazda bağlanır (sahte YOK).
self.addEventListener('push', (e) => {
  if (!e.data) return;
  try {
    const { title, body } = e.data.json();
    e.waitUntil(self.registration.showNotification(title || 'Pazarlama Merkezi', { body: body || '', icon: '/icon.svg' }));
  } catch { /* geçersiz payload sessizce yoksayılır */ }
});
