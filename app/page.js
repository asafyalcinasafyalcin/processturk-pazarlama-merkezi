import Link from 'next/link';
import { readProducts } from '@/lib/products';
import { readAllContent } from '@/lib/content';
import { syncWebsiteProducts, getWebsiteSyncStatus } from '@/lib/website-sync';
import { marketingStatus, matchesFilter, FILTERS } from '@/lib/marketing-status';
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

// Ürünün pazarlama durumuna göre üst köşe rozeti.
function StatusBadge({ status, product }) {
  if (product.website?.removedFromSite) {
    return <span className="pill pill-muted" title="Web sitesinde artık yayında değil">🌐 kaldırıldı</span>;
  }
  const onSite = Boolean(product.website);
  if (status.ready && !status.steps.campaign) {
    return <span className="pill" style={{ background: '#fff4e5', color: '#b45309' }} title="Reklama hazır ama Meta kampanyası yok">⚡ kampanyasız</span>;
  }
  if (status.ready) return <span className="pill pill-ok" title="Reklama hazır">✓ hazır</span>;
  if (onSite) return <span className="pill" style={{ background: '#fde8ec', color: '#c81e4a' }} title="Sitede yayında ama reklamı eksik">● reklam eksik</span>;
  return <span className="pill pill-muted">taslak</span>;
}

function ProductCard({ p, content, status }) {
  const m = p.marketing || {};
  const img = cardImage(p, content);
  const S = status.steps;
  return (
    <Link href={`/urun/${p.slug}`} className="card card-hover p-5 flex flex-col">
      {/* Görsel alanı: object-COVER ile kutuyu tamamen doldurur.
          Eskiden object-contain idi → 4:3 fotoğraf 2.2:1 kutuya sığdırılıyor, iki yanda
          beyaz boşluk kalıyor ve makine ortada ufacık duruyordu (Asaf geri bildirimi).
          Kutu oranı da 3:2'ye çekildi: kaynak fotoğraflar 4:3 olduğu için kırpma azalır,
          makine gövdesi kadraj dışında kalmaz. object-center üstü/altı dengeli kırpar. */}
      {img ? (
        <div className="-mx-5 -mt-5 mb-4 aspect-[3/2] overflow-hidden rounded-t-[1.05rem] bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt={m.name_tr || p.name_en} className="w-full h-full object-cover object-center" loading="lazy" />
        </div>
      ) : (
        <div className="-mx-5 -mt-5 mb-4 aspect-[3/2] rounded-t-[1.05rem] bg-slate-100 flex items-center justify-center text-3xl text-slate-300">📦</div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-head font-bold text-base leading-tight">{m.name_tr || p.name_en}</h3>
          <div className="text-xs text-slate-500 mt-0.5">{p.category}</div>
        </div>
        <span className="flex flex-col items-end gap-1">
          <StatusBadge status={status} product={p} />
          {p.website && !p.website.removedFromSite && <span className="pill pill-muted text-[10px]" title={p.website.url}>🌐 site</span>}
        </span>
      </div>

      <div className="mt-4 num text-xl text-red font-extrabold">{p.price_text || '—'}</div>

      <div className="mt-3 text-xs text-slate-500 space-y-1">
        {p.specs?.capacity && <div>⚙ {p.specs.capacity}</div>}
        {m.audience && <div>🎯 {m.audience}</div>}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
        <span className={`pill ${S.brief ? 'pill-ok' : 'pill-muted'}`}>Brief</span>
        <span className={`pill ${S.copy ? 'pill-ok' : 'pill-muted'}`}>Metin</span>
        <span className={`pill ${S.gorsel ? 'pill-ok' : 'pill-muted'}`}>Görsel</span>
        <span className={`pill ${S.creative ? 'pill-ok' : 'pill-muted'}`}>Creative{status.creativesCount ? ` ${status.creativesCount}` : ''}</span>
        <span className={`pill ${S.video ? 'pill-ok' : 'pill-muted'}`}>Video</span>
        <span className={`pill ${S.campaign ? 'pill-ok' : 'pill-muted'}`}>Kampanya</span>
      </div>

      <div className="mt-5 pt-4 border-t border-line text-sm text-red font-head font-bold">İçerik üret →</div>
    </Link>
  );
}

// Filtre çubuğu — server component, linklerle çalışır (?durum=...).
function FilterBar({ active, counts }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {FILTERS.map((f) => {
        const on = active === f.key || (f.key === 'all' && !active);
        const n = counts[f.key] ?? 0;
        return (
          <Link
            key={f.key}
            href={f.key === 'all' ? '/' : `/?durum=${f.key}`}
            className={`pill ${on ? 'pill-ok' : 'pill-muted'} !text-xs !px-3 !py-1.5`}
            style={on ? undefined : { cursor: 'pointer' }}
          >
            {f.label} <span className="opacity-60">{n}</span>
          </Link>
        );
      })}
    </div>
  );
}

export default async function HomePage({ searchParams }) {
  const sp = await searchParams;
  const filter = sp?.durum || 'all';
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

  // Her ürünün pazarlama durumu (bir kez hesapla; hem sayaç hem filtre hem kart kullanır).
  const withStatus = products.map((p) => ({ p, content: contentMap[p.slug], status: marketingStatus(p, contentMap[p.slug]) }));
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.key, withStatus.filter(({ p, status }) => matchesFilter(f.key, status, p)).length]),
  );
  const shown = withStatus.filter(({ p, status }) => matchesFilter(filter, status, p));

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

      {products.length > 0 && <FilterBar active={sp?.durum} counts={counts} />}

      {shown.length === 0 && products.length > 0 && (
        <div className="card p-8 text-center text-sm text-slate-500">Bu filtrede ürün yok.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {shown.map(({ p, content, status }) => <ProductCard key={p.slug} p={p} content={content} status={status} />)}
      </div>
    </div>
  );
}
