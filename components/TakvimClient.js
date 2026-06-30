'use client';

import { useState } from 'react';

const STATUS = {
  draft:     { label: 'Taslak',      cls: 'pill-muted' },
  approved:  { label: 'Onaylı',      cls: 'pill-amber' },
  published: { label: 'Yayınlandı',  cls: 'pill-ok' },
};
const PLATFORM_LABEL = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X' };
const REAL = ['instagram', 'facebook', 'linkedin', 'x'];

function ContentModal({ item, names, busy, onApprove, onPublish, onRemove, onClose }) {
  if (!item) return null;
  const pl = PLATFORM_LABEL[item.platform] || item.platform;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Başlık */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="pill pill-muted">{pl}</span>
            <span className={`pill ${STATUS[item.status].cls}`}>{STATUS[item.status].label}</span>
            <span className="text-xs text-slate-400">{names[item.slug] || item.slug} · {item.lang?.toUpperCase()}</span>
            {item.variantId && <span className="text-xs text-slate-400">varyant {item.variantId}</span>}
          </div>
          <button className="text-slate-400 hover:text-slate-700 text-lg" onClick={onClose}>✕</button>
        </div>

        {/* Görsel/Video önizleme */}
        {(item.imageUrl || item.videoUrl) && (
          <div className="mb-3 flex gap-2 flex-wrap">
            {item.imageUrl && (
              <a href={item.imageUrl} target="_blank" rel="noreferrer">
                <img src={item.imageUrl} alt="görsel" className="h-24 w-auto rounded object-cover border border-line" />
              </a>
            )}
            {item.videoUrl && (
              <video src={item.videoUrl} controls preload="metadata" playsInline
                className="h-24 w-auto rounded object-contain border border-line bg-black" />
            )}
          </div>
        )}

        {/* Tam metin */}
        <div className="mb-4">
          <div className="text-xs text-slate-400 mb-1">Metin / Açıklama</div>
          <div className="bg-slate-50 border border-line rounded-xl p-4 text-sm text-slate-700 whitespace-pre-line max-h-64 overflow-y-auto">
            {item.caption || '(metin yok)'}
          </div>
        </div>

        {item.result?.method === 'assisted' && (
          <div className="text-[11px] text-slate-500 bg-amber/10 border border-amber/30 rounded-lg p-2 mb-3">
            Manuel paylaş: videoyu indir + açıklamayı yapıştır.{item.result.package?.hashtags ? ` ${item.result.package.hashtags}` : ''}
          </div>
        )}

        {/* Eylemler */}
        <div className="flex items-center gap-2 flex-wrap justify-end border-t border-line pt-3 mt-2">
          {item.status === 'draft' && (
            <button className="btn btn-primary text-sm" disabled={busy === item.id} onClick={() => onApprove(item)}>
              {busy === item.id ? '…' : '✓ Onayla'}
            </button>
          )}
          {item.status === 'approved' && (
            <button className="btn btn-primary text-sm" disabled={busy === item.id} onClick={() => onPublish(item)}>
              {busy === item.id ? '…' : (REAL.includes(item.platform) ? '🚀 Yayınla' : '📦 Paketle & işaretle')}
            </button>
          )}
          {item.status !== 'published' && (
            <button className="btn btn-ghost text-sm text-red" disabled={busy === item.id} onClick={() => onRemove(item)}>
              🗑 Kaldır
            </button>
          )}
          <button className="btn btn-ghost text-sm" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}

export default function TakvimClient({ initialItems, names }) {
  const [items, setItems] = useState(initialItems || []);
  const [busy, setBusy] = useState(null);
  const [selected, setSelected] = useState(null);

  function replace(updated) {
    setItems((list) => list.map((it) => (it.id === updated.id ? updated : it)));
    if (selected?.id === updated.id) setSelected(updated);
  }

  async function approve(item) {
    setBusy(item.id);
    const res = await fetch('/api/calendar', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status: 'approved' }) });
    const data = await res.json();
    if (data.ok) replace(data.item);
    setBusy(null);
  }

  async function publish(item) {
    setBusy(item.id);
    const res = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
    const data = await res.json();
    if (data.ok) replace(data.item);
    else alert('Yayın: ' + data.error);
    setBusy(null);
  }

  async function remove(item) {
    setBusy(item.id);
    await fetch(`/api/calendar?id=${item.id}`, { method: 'DELETE' });
    setItems((list) => list.filter((it) => it.id !== item.id));
    setBusy(null); setSelected(null);
  }

  const groups = ['draft', 'approved', 'published'];

  return (
    <div className="space-y-8">
      {items.length === 0 && (
        <div className="card p-10 text-center text-slate-400">
          Takvim boş. Bir ürünün detayından <b>"Takvime ekle"</b> ile gönderi oluştur.
        </div>
      )}

      {groups.map((g) => {
        const list = items.filter((it) => it.status === g);
        if (list.length === 0) return null;
        return (
          <section key={g}>
            <h2 className="font-head font-bold text-sm mb-3 flex items-center gap-2">
              <span className={`pill ${STATUS[g].cls}`}>{STATUS[g].label}</span>
              <span className="text-slate-500">({list.length})</span>
            </h2>
            <div className="space-y-3">
              {list.map((it) => (
                <div key={it.id}
                  className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelected(it)}>
                  <div className="flex items-start gap-3">
                    {it.videoUrl ? (
                      <video src={it.videoUrl} muted playsInline preload="metadata"
                        className="w-16 h-16 rounded object-cover border border-line bg-black shrink-0" />
                    ) : it.imageUrl ? (
                      <img src={it.imageUrl} alt="" loading="lazy"
                        className="w-16 h-16 rounded object-cover border border-line shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded border border-line bg-slate-100 grid place-items-center text-slate-300 text-xs shrink-0">—</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="pill pill-muted">{PLATFORM_LABEL[it.platform] || it.platform}</span>
                        <span className="text-xs text-slate-400">{names[it.slug] || it.slug} · {it.lang?.toUpperCase()}{it.variantId ? ` · ${it.variantId}` : ''}</span>
                        {REAL.includes(it.platform)
                          ? <span className="text-[10px] text-ok">otomatik yayın</span>
                          : <span className="text-[10px] text-amber">assisted</span>}
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{it.caption || '(metin yok)'}</p>
                      <div className="flex gap-2 mt-1">
                        {it.imageUrl && <span className="text-[10px] text-slate-400">🖼 görsel</span>}
                        {it.videoUrl && <span className="text-[10px] text-red">🎬 video</span>}
                        <span className="text-[10px] text-slate-300 ml-auto">tıkla için detay →</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <ContentModal
        item={selected}
        names={names}
        busy={busy}
        onApprove={approve}
        onPublish={publish}
        onRemove={remove}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
