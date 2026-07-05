#!/usr/bin/env node
// Web sitesi kataloğunu Pazarlama Merkezi'ne elle eşitler (çalışan panel üzerinden).
// Kullanım: node scripts/sync-website.mjs [panel-adresi]
// Varsayılan panel: http://127.0.0.1:4181 (PANEL_URL env ile de verilebilir).
const panel = (process.argv[2] || process.env.PANEL_URL || 'http://127.0.0.1:4181').replace(/\/+$/, '');

try {
  const res = await fetch(panel + '/api/website-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force: true, maxImageDownloads: 50 }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error('✗ Eşitleme başarısız:', data.error || res.status);
    process.exit(1);
  }
  console.log('✓ Eşitlendi —', data.base);
  console.log(`  toplam ürün: ${data.total} · sitede: ${data.siteCount}`);
  if (data.added?.length) console.log('  yeni eklenen:', data.added.join(', '));
  if (data.linked?.length) console.log('  siteye bağlanan:', data.linked.join(' | '));
  if (data.imagesDownloaded) console.log('  indirilen görsel:', data.imagesDownloaded);
  if (data.pendingImages) console.log('  sıradaki görsel (tekrar çalıştır):', data.pendingImages);
  if (data.removedFromSite?.length) console.log('  sitede artık yok (panelde korunuyor):', data.removedFromSite.join(', '));
} catch (err) {
  console.error('✗ Panele ulaşılamadı:', panel, '—', err.message);
  console.error('  Önce paneli başlat: ./start-local.sh (http://127.0.0.1:4181)');
  process.exit(1);
}
