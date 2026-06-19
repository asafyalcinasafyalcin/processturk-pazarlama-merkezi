'use client';

import { useState } from 'react';

const STATUS = {
  draft: { label: 'Taslak', cls: 'pill-muted' },
  approved: { label: 'Onaylı', cls: 'pill-amber' },
  published: { label: 'Yayınlandı', cls: 'pill-ok' },
};
const PLATFORM_LABEL = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X' };
const REAL = ['instagram', 'facebook', 'linkedin', 'x'];

export default function TakvimClient({ initialItems, names }) {
  const [items, setItems] = useState(initialItems || []);
  const [busy, setBusy] = useState(null);
  const [confirming, setConfirming] = useState(null); // approval gate modal item

  function replace(updated) {
    setItems((list) => list.map((it) => (it.id === updated.id ? updated : it)));
  }

  async function approve(item) {
    setBusy(item.id);
    const res = await fetch('/api/calendar', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status: 'approved' }) });
    const data = await res.json();
    if (data.ok) replace(data.item);
    setBusy(null); setConfirming(null);
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
    setBusy(null);
  }

  const groups = ['draft', 'approved', 'published'];

  return (
    <div className="space-y-8">
      {items.length === 0 && (
        <div className="card p-10 text-center text-slate-400">
          Takvim boş. Bir ürünün detayından <b>“Takvime ekle”</b> ile gönderi oluştur.
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
                <div key={it.id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="pill pill-muted">{PLATFORM_LABEL[it.platform] || it.platform}</span>
                        <span className="text-xs text-slate-400">{names[it.slug] || it.slug} · {it.lang?.toUpperCase()} · varyant {it.variantId || '—'}</span>
                        {REAL.includes(it.platform)
                          ? <span className="text-[10px] text-ok">otomatik yayın</span>
                          : <span className="text-[10px] text-amber">assisted (manuel)</span>}
                      </div>
                      <p className="text-sm text-slate-600 whitespace-pre-line line-clamp-3">{it.caption}</p>
                      {it.videoUrl && <a href={it.videoUrl} target="_blank" rel="noreferrer" className="text-xs text-red hover:underline">🎬 video</a>}
                      {it.result?.method === 'assisted' && (
                        <div className="mt-2 text-[11px] text-slate-400 bg-amber/10 border border-amber/30 rounded-lg p-2">
                          Manuel paylaş: videoyu indir + açıklamayı yapıştır. {it.result.package?.hashtags}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {it.status === 'draft' && (
                        <button className="btn btn-ghost text-sm" disabled={busy === it.id} onClick={() => setConfirming(it)}>✓ Onayla</button>
                      )}
                      {it.status === 'approved' && (
                        <button className="btn btn-primary text-sm" disabled={busy === it.id} onClick={() => publish(it)}>
                          {busy === it.id ? '…' : (REAL.includes(it.platform) ? '🚀 Yayınla' : '📦 Paketle & işaretle')}
                        </button>
                      )}
                      {it.status !== 'published' && (
                        <button className="text-xs text-slate-500 hover:text-red" disabled={busy === it.id} onClick={() => remove(it)}>sil</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* ONAY KAPISI modal */}
      {confirming && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setConfirming(null)}>
          <div className="card p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-head font-extrabold text-lg mb-2">Gönderiyi onayla</h3>
            <p className="text-xs text-slate-400 mb-4">Onaydan sonra yayınlanabilir hale gelir. İçerik + platform + hedefi kontrol et:</p>
            <div className="space-y-2 text-sm">
              <div><span className="text-slate-500 text-xs">Platform:</span> <b>{PLATFORM_LABEL[confirming.platform]}</b> {REAL.includes(confirming.platform) ? '(otomatik yayın)' : '(manuel/assisted)'}</div>
              <div><span className="text-slate-500 text-xs">Ürün / dil:</span> {names[confirming.slug] || confirming.slug} · {confirming.lang?.toUpperCase()}</div>
              <div className="bg-slate-100 border border-line rounded-lg p-3 whitespace-pre-line text-slate-700">{confirming.caption}</div>
              {confirming.videoUrl && <div className="text-xs text-red">🎬 video ekli</div>}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-ghost text-sm" onClick={() => setConfirming(null)}>Vazgeç</button>
              <button className="btn btn-primary text-sm" disabled={busy === confirming.id} onClick={() => approve(confirming)}>✓ Onaylıyorum</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
