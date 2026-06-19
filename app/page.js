import Link from 'next/link';
import { readProducts } from '@/lib/products';
import { readAllContent } from '@/lib/content';

export const dynamic = 'force-dynamic';

function PageHeader({ count }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="font-head font-extrabold text-2xl md:text-3xl">Ürünler</h1>
        <p className="text-slate-400 mt-1 text-sm">
          {count} ürün · katalog tek kaynaktan (<span className="font-mono">products.json</span>) okunuyor
        </p>
      </div>
      <Link href="/urun/yeni" className="btn btn-primary">+ Yeni Ürün Ekle</Link>
    </div>
  );
}

function ProductCard({ p, content }) {
  const m = p.marketing || {};
  const hasCopy = Boolean(content?.copy);
  const hasVideo = Boolean(content?.video?.url);
  return (
    <Link href={`/urun/${p.slug}`} className="card card-hover p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-head font-bold text-base leading-tight">{m.name_tr || p.name_en}</h3>
          <div className="text-xs text-slate-400 mt-0.5">{p.category}</div>
        </div>
        {p.hd ? <span className="pill pill-ok">HD</span> : <span className="pill pill-muted">SD</span>}
      </div>

      <div className="mt-4 num text-xl text-red font-extrabold">{p.price_text || '—'}</div>

      <div className="mt-3 text-xs text-slate-400 space-y-1">
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
  try {
    products = await readProducts();
    contentMap = await readAllContent();
  } catch (err) {
    error = err.message;
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto">
      <PageHeader count={products.length} />

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
