import Link from 'next/link';
import { readProducts } from '@/lib/products';
import { readAllContent } from '@/lib/content';
import { syncWebsiteProducts, getWebsiteSyncStatus } from '@/lib/website-sync';
import WebsiteSyncButton from './website-sync-button';

export const dynamic = 'force-dynamic';

function PageHeader({ count, siteCount, lastSyncAt }) {
  const syncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
    : 'henüz yok';
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="font-head font-extrabold text-2xl md:text-3xl">Ürünler</h1>
        <p className="text-slate-500 mt-1 text-sm">
          {count} ürün · {siteCount} tanesi web sitesine bağlı · son eşitleme: {syncLabel}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <WebsiteSyncButton />
        <Link href="/urun/yeni" className="btn btn-primary">+ Yeni Ürün Ekle</Link>
      </div>
    </div>
  );
}

// Kart görseli: panelde üretilen/eklenen ana görsel → yoksa web sitesi görseli.
function cardImage(p, content) {
  return content?.gorsel?.localPath || content?.gorsel?.url || p.website?.image?.servedUrl || null;
}

function ProductCard({ p, content }) {
  const m = p.marketing || {};
  const hasCopy = Boolean(content?.copy);
  const hasVideo = Boolean(content?.video?.url);
  const img = cardImage(p, content);
  return (
    <Link href={`/urun/${p.slug}`} className="card card-hover p-5 flex flex-col">
      {img ? (
        <div className="-mx-5 -mt-5 mb-4 h-40 overflow-hidden rounded-t-[1.05rem] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt={m.name_tr || p.name_en} className="w-full h-full object-contain" loading="lazy" />
        </div>
      ) : (
        <div className="-mx-5 -mt-5 mb-4 h-40 rounded-t-[1.05rem] bg-slate-100 flex items-center justify-center text-3xl text-slate-300">📦</div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-head font-bold text-base leading-tight">{m.name_tr || p.name_en}</h3>
          <div className="text-xs text-slate-500 mt-0.5">{p.category}</div>
        </div>
        <span className="flex flex-col items-end gap-1">
          {p.hd ? <span className="pill pill-ok">HD</span> : <span className="pill pill-muted">SD</span>}
          {p.website && !p.website.removedFromSite && <span className="pill pill-muted" title={p.website.url}>🌐 site</span>}
          {p.website?.removedFromSite && <span className="pill pill-muted" title="Web sitesinde artık yayında değil">🌐 kaldırıldı</span>}
        </span>
      </div>

      <div className="mt-4 num text-xl text-red font-extrabold">{p.price_text || '—'}</div>

      <div className="mt-3 text-xs text-slate-500 space-y-1">
        {p.specs?.capacity && <div>⚙ {p.specs.capacity}</div>}
        {m.audience && <div>🎯 {m.audience}</div>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        <span className={`pill ${hasCopy ? 'pill-ok' : 'pill-muted'}`}>Metin: {hasCopy ? 'var' : 'yok'}</span>
        <span className={`pill ${hasVideo ? 'pill-ok' : 'pill-muted'}`}>Video: {hasVideo ? 'var' : 'yok'}</span>
      </div>

      <div className="mt-5 pt-4 border-t border-line text-sm text-red font-head font-bold">İçerik üret →</div>
    </Link>
  );
}

export default async function HomePage() {
  let products = [];
  let contentMap = {};
  let error = null;
  // Web sitesi kataloğuyla otomatik eşitleme (TTL'li — 10 dk içinde tekrar çalışmaz,
  // site kapalıysa sessizce geçer; panel her durumda açılır).
  await syncWebsiteProducts({ maxImageDownloads: 4 }).catch(() => null);
  const syncStatus = getWebsiteSyncStatus();
  try {
    products = await readProducts();
    contentMap = await readAllContent();
  } catch (err) {
    error = err.message;
  }

  const siteCount = products.filter((p) => p.website && !p.website.removedFromSite).length;

  return (
    <div className="px-4 md:px-10 py-8 max-w-7xl mx-auto">
      <PageHeader count={products.length} siteCount={siteCount} lastSyncAt={syncStatus.lastSyncAt} />

      {error && (
        <div className="card p-4 border-red/40 text-sm text-red mb-6">
          Katalog okunamadı: {error}
        </div>
      )}

      {products.length === 0 && !error && (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">📦</div>
          <p className="text-slate-600">Henüz ürün yok.</p>
          <Link href="/urun/yeni" className="btn btn-primary mt-4 inline-flex">İlk ürünü ekle</Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map((p) => <ProductCard key={p.slug} p={p} content={contentMap[p.slug]} />)}
      </div>
    </div>
  );
}
