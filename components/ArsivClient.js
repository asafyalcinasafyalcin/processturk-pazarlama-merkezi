'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const TYPE_LABEL = { gorsel: '🖼️ Görsel', video: '🎬 Video', ses: '🎙️ Ses', metin: '✍️ Metin' };
const TYPE_ORDER = ['all', 'gorsel', 'video', 'ses', 'metin'];

export default function ArsivClient() {
  const [entries, setEntries] = useState([]);
  const [fType, setFType] = useState('all');
  const [fSlug, setFSlug] = useState('all');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/library?includeArchived=1');
    const d = await res.json();
    if (d.ok) setEntries(d.entries);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function remove(a) {
    if (!confirm('Bu içeriği kalıcı olarak silmek istediğine emin misin?')) return;
    setBusy(a.id);
    await fetch('/api/library', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id }) });
    setSelected(null);
    await load();
    setBusy(null);
  }

  // Arşivle / geri getir (silmeden gizle)
  async function archive(a, val) {
    setBusy(a.id);
    await fetch('/api/library', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, archived: val }) });
    setSelected(null);
    await load();
    setBusy(null);
  }

  const products = [...new Map(entries.map((e) => [e.slug, e.productName])).entries()];
  const archivedCount = entries.filter((a) => a.archived).length;
  const shown = entries.filter((a) =>
    (fType === 'all' || a.type === fType) &&
    (fSlug === 'all' || a.slug === fSlug) &&
    (showArchived ? a.archived : !a.archived));

  const counts = TYPE_ORDER.reduce((acc, t) => {
    acc[t] = t === 'all' ? entries.length : entries.filter((e) => e.type === t).length;
    return acc;
  }, {});

  return (
    <div>
      {/* Filtreler */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TYPE_ORDER.map((t) => (
          <button key={t} onClick={() => setFType(t)} className={`pill ${fType === t ? 'pill-ok' : 'pill-muted'}`}>
            {t === 'all' ? 'Hepsi' : TYPE_LABEL[t]} <span className="opacity-60">({counts[t]})</span>
          </button>
        ))}
        <span className="mx-1 text-slate-300">·</span>
        <button onClick={() => setShowArchived((s) => !s)} className={`pill ${showArchived ? 'pill-ok' : 'pill-muted'}`}>
          🗄 Arşiv{archivedCount > 0 ? ` (${archivedCount})` : ''}
        </button>
      </div>
      {products.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setFSlug('all')} className={`pill text-xs ${fSlug === 'all' ? 'pill-ok' : 'pill-muted'}`}>Tüm ürünler</button>
          {products.map(([slug, name]) => (
            <button key={slug} onClick={() => setFSlug(slug)} className={`pill text-xs ${fSlug === slug ? 'pill-ok' : 'pill-muted'}`}>{name}</button>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-slate-500">Yükleniyor…</p>}
      {!loading && shown.length === 0 && <p className="text-sm text-slate-500">Henüz içerik yok. Ürün sayfasında görsel/video/metin üretince burada birikir.</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {shown.map((a) => {
          const mediaUrl = a.localPath || a.url;
          return (
            <button key={a.id} onClick={() => setSelected(a)}
              className="border border-line rounded-xl overflow-hidden text-left hover:border-navy/50 hover:shadow-sm transition bg-white">
              <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                {a.type === 'gorsel' && mediaUrl ? <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                  : a.type === 'video' && mediaUrl ? <video src={mediaUrl} className="w-full h-full object-cover" muted />
                  : <span className="text-3xl opacity-40">{(TYPE_LABEL[a.type] || '📄').split(' ')[0]}</span>}
              </div>
              <div className="p-2">
                <div className="text-[11px] font-semibold truncate">{a.productName}</div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                  <span>{(TYPE_LABEL[a.type] || a.type).split(' ')[0]}</span>
                  <span className="pill pill-muted text-[9px]">{(a.lang || 'tr').toUpperCase()}</span>
                  {a.manual && <span className="pill pill-ok text-[9px]">yüklendi</span>}
                </div>
                <div className="text-[10px] text-slate-500">{new Date(a.at).toLocaleDateString('tr-TR')}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detay modalı */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-line">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">{TYPE_LABEL[selected.type] || selected.type}</span>
                <span className="pill pill-muted text-xs">{(selected.lang || 'tr').toUpperCase()}</span>
                <Link href={`/urun/${selected.slug}`} className="text-xs text-navy underline">{selected.productName}</Link>
              </div>
              <button className="text-slate-500 hover:text-slate-700 text-xl leading-none" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="p-4 space-y-3">
              {selected.type === 'gorsel' && (selected.localPath || selected.url) && (
                <img src={selected.localPath || selected.url} alt="" className="w-full rounded-xl border border-line" />
              )}
              {selected.type === 'video' && (selected.localPath || selected.url) && (
                <video src={selected.localPath || selected.url} controls className="w-full rounded-xl border border-line bg-black" />
              )}
              {selected.type === 'ses' && (selected.voiceUrl || selected.localPath || selected.url) && (
                <audio src={selected.voiceUrl || selected.localPath || selected.url} controls className="w-full" />
              )}
              {selected.caption && (
                <div className="whitespace-pre-wrap text-sm text-slate-700 bg-slate-50 rounded-xl p-3 border border-line">{selected.caption}</div>
              )}
              <dl className="text-xs text-slate-500 space-y-1">
                {selected.concept && <div><span className="text-slate-500">Konsept:</span> {selected.concept}</div>}
                {selected.template && <div><span className="text-slate-500">Şablon:</span> {selected.template}</div>}
                {selected.platform && <div><span className="text-slate-500">Platform:</span> {selected.platform}</div>}
                {selected.model && <div><span className="text-slate-500">Model:</span> {selected.model}</div>}
                <div><span className="text-slate-500">Tarih:</span> {new Date(selected.at).toLocaleString('tr-TR')}</div>
              </dl>
            </div>
            <div className="flex items-center gap-2 p-4 border-t border-line">
              {(selected.localPath || selected.url) && (
                <a href={selected.localPath || selected.url} download className="btn btn-ghost text-sm">⬇ İndir</a>
              )}
              <Link href={`/urun/${selected.slug}`} className="btn btn-ghost text-sm">Ürüne git →</Link>
              <button className="btn btn-ghost text-sm ml-auto" disabled={busy === selected.id} onClick={() => archive(selected, !selected.archived)}>
                {busy === selected.id ? '…' : selected.archived ? '↩ Geri getir' : '🗄 Arşivle'}
              </button>
              <button className="btn btn-ghost text-sm text-red" disabled={busy === selected.id} onClick={() => remove(selected)}>
                {busy === selected.id ? 'Siliniyor…' : '🗑 Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
