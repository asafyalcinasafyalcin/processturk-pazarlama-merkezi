'use client';

import { useEffect, useState } from 'react';
import { medyaUrl } from '@/lib/medya-url';

const STATUS = {
  draft:                  { label: 'Taslak',       cls: 'pill-muted' },
  approved:               { label: 'Onaylı',       cls: 'pill-amber' },
  published:              { label: 'Yayınlandı',   cls: 'pill-ok' },
  manual_action_required: { label: 'Manuel işlem', cls: 'pill-amber' },
  cancelled:              { label: 'İptal edildi', cls: 'pill-muted' },
};
const FALLBACK_STATUS = { label: 'Bilinmiyor', cls: 'pill-muted' };
const PLATFORM_LABEL = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X' };
// Sunucudan gelmezse eski (statik) varsayım — bkz. /api/accounts/status.
const REAL_FALLBACK = ['instagram', 'facebook', 'linkedin', 'x'];

// Satırın/modalın altında görünen aksiyon butonları — TEK yerde tanımlı, hem kart hem
// modal aynı fonksiyonları çağırır (davranış iki yerde AYRIŞMASIN diye).
function Aksiyonlar({ item, busy, real, onApprove, onPublish, onMarkPublished, onCancel, onRestore, onRemove, boyut = 'sm' }) {
  const cls = `btn text-${boyut}`;
  return (
    <>
      {item.status === 'draft' && (
        <button className={`btn-primary ${cls}`} disabled={busy === item.id} onClick={(e) => { e.stopPropagation(); onApprove(item); }}>
          {busy === item.id ? '…' : '✓ Onayla'}
        </button>
      )}
      {item.status === 'approved' && (
        <button className={`btn-primary ${cls}`} disabled={busy === item.id} onClick={(e) => { e.stopPropagation(); onPublish(item); }}>
          {busy === item.id ? '…' : (real.includes(item.platform) ? '🚀 Yayınla' : '📦 Paket / elle yükle')}
        </button>
      )}
      {item.status === 'manual_action_required' && (
        <button className={`btn-primary ${cls}`} disabled={busy === item.id} onClick={(e) => { e.stopPropagation(); onMarkPublished(item); }}>
          {busy === item.id ? '…' : '✓ Yayınlandı işaretle'}
        </button>
      )}
      {/* Beğenilmedi → kuyruktan çıkar ama SİLME (geri alınabilir). */}
      {['draft', 'approved', 'manual_action_required'].includes(item.status) && (
        <button className={`btn-ghost ${cls}`} disabled={busy === item.id} onClick={(e) => { e.stopPropagation(); onCancel(item); }}>
          ⏸ İptal et
        </button>
      )}
      {item.status === 'cancelled' && (
        <button className={`btn-ghost ${cls}`} disabled={busy === item.id} onClick={(e) => { e.stopPropagation(); onRestore(item); }}>
          ↩ Geri al
        </button>
      )}
      {item.status !== 'published' && (
        <button className={`btn-ghost ${cls} text-red`} disabled={busy === item.id} onClick={(e) => { e.stopPropagation(); onRemove(item); }}>
          🗑 Sil
        </button>
      )}
    </>
  );
}

function ContentModal({ item, names, busy, real, onApprove, onPublish, onMarkPublished, onCancel, onRestore, onRemove, onClose }) {
  if (!item) return null;
  const pl = PLATFORM_LABEL[item.platform] || item.platform;
  const st = STATUS[item.status] || FALLBACK_STATUS;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="pill pill-muted">{pl}</span>
            <span className={`pill ${st.cls}`}>{st.label}</span>
            <span className="text-xs text-slate-500">{names[item.slug] || item.slug} · {item.lang?.toUpperCase()}</span>
            {item.variantId && <span className="text-xs text-slate-500">varyant {item.variantId}</span>}
          </div>
          <button className="text-slate-500 hover:text-slate-700 text-lg" onClick={onClose}>✕</button>
        </div>

        {(item.imageUrl || item.videoUrl) && (
          <div className="mb-3 flex gap-2 flex-wrap">
            {item.imageUrl && (
              <a href={item.imageUrl} target="_blank" rel="noreferrer">
                <img src={item.imageUrl} alt="görsel" className="h-24 w-auto rounded object-cover border border-line" />
              </a>
            )}
            {item.videoUrl && (
              <video src={medyaUrl(item.videoUrl)} controls preload="metadata" playsInline
                className="h-24 w-auto rounded object-contain border border-line bg-black" />
            )}
          </div>
        )}

        <div className="mb-4">
          <div className="text-xs text-slate-500 mb-1">Metin / Açıklama</div>
          <div className="bg-slate-50 border border-line rounded-xl p-4 text-sm text-slate-700 whitespace-pre-line max-h-64 overflow-y-auto">
            {item.caption || '(metin yok)'}
          </div>
        </div>

        {item.result?.method === 'assisted' && (
          <div className="text-[11px] text-slate-500 bg-amber/10 border border-amber/30 rounded-lg p-2 mb-3">
            Manuel paylaş: videoyu indir + açıklamayı yapıştır.{item.result.package?.hashtags ? ` ${item.result.package.hashtags}` : ''}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap justify-end border-t border-line pt-3 mt-2">
          <Aksiyonlar item={item} busy={busy} real={real} onApprove={onApprove} onPublish={onPublish} onMarkPublished={onMarkPublished} onCancel={onCancel} onRestore={onRestore} onRemove={onRemove} />
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
  const [secililer, setSecililer] = useState(() => new Set());
  const [topluIsleniyor, setTopluIsleniyor] = useState(false);
  const [real, setReal] = useState(REAL_FALLBACK);

  // /api/publish gerçek-API mi assisted mi karar verirken hangi platformların
  // yapılandırılmış olduğuna bakıyor — buradaki rozet de AYNI kaynağı okumalı, ikinci
  // bir statik tahmin (eski REAL dizisi) yayın anıyla UYUŞMAYABİLİR.
  useEffect(() => {
    fetch('/api/accounts/status')
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        setReal(Object.entries(d.hesaplar).filter(([, v]) => v.configured).map(([k]) => k));
      })
      .catch(() => {});
  }, []);

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

  async function markPublished(item) {
    setBusy(item.id);
    const res = await fetch('/api/calendar', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status: 'published', publishedAt: new Date().toISOString() }) });
    const data = await res.json();
    if (data.ok) replace(data.item);
    else alert('İşaretleme: ' + data.error);
    setBusy(null);
  }

  // Beğenilmedi → kuyruktan çıkar, SİLME. /api/publish yalnız 'approved' yayınladığı için
  // iptal edilmiş öğe hiçbir koşulda yayına gitmez.
  async function cancel(item) {
    setBusy(item.id);
    const res = await fetch('/api/calendar', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status: 'cancelled' }) });
    const data = await res.json();
    if (data.ok) replace(data.item);
    else alert('İptal: ' + data.error);
    setBusy(null);
  }

  async function restore(item) {
    setBusy(item.id);
    const res = await fetch('/api/calendar', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status: 'draft' }) });
    const data = await res.json();
    if (data.ok) replace(data.item);
    else alert('Geri alma: ' + data.error);
    setBusy(null);
  }

  async function remove(item) {
    setBusy(item.id);
    await fetch(`/api/calendar?id=${item.id}`, { method: 'DELETE' });
    setItems((list) => list.filter((it) => it.id !== item.id));
    setSecililer((s) => { const n = new Set(s); n.delete(item.id); return n; });
    setBusy(null); setSelected(null);
  }

  function secimDegistir(id) {
    setSecililer((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function grupSecTumu(list) {
    setSecililer((s) => {
      const n = new Set(s);
      const hepsiSecili = list.every((it) => n.has(it.id));
      list.forEach((it) => (hepsiSecili ? n.delete(it.id) : n.add(it.id)));
      return n;
    });
  }

  // Toplu işlem — draft'ları tek tek onayla (sunucu tarafında zaten atomik PATCH var,
  // burada sadece sıralı çağrı: eşzamanlı N istekte dosya-yazım yarışını önler).
  async function topluOnayla() {
    setTopluIsleniyor(true);
    for (const id of secililer) {
      const it = items.find((x) => x.id === id);
      if (it?.status === 'draft') await approve(it);
    }
    setSecililer(new Set());
    setTopluIsleniyor(false);
  }

  async function topluIptal() {
    setTopluIsleniyor(true);
    for (const id of secililer) {
      const it = items.find((x) => x.id === id);
      if (it && ['draft', 'approved', 'manual_action_required'].includes(it.status)) await cancel(it);
    }
    setSecililer(new Set());
    setTopluIsleniyor(false);
  }

  async function topluKaldir() {
    if (!confirm(`${secililer.size} öğe KALICI olarak silinecek. Emin misin?`)) return;
    setTopluIsleniyor(true);
    for (const id of secililer) {
      const it = items.find((x) => x.id === id);
      if (it && it.status !== 'published') await remove(it);
    }
    setSecililer(new Set());
    setTopluIsleniyor(false);
  }

  const groups = ['draft', 'approved', 'manual_action_required', 'published', 'cancelled'];

  return (
    <div className="space-y-8 pb-20">
      {items.length === 0 && (
        <div className="card p-10 text-center text-slate-500">
          Takvim boş. Bir ürünün detayından <b>"Takvime ekle"</b> ile gönderi oluştur.
        </div>
      )}

      {groups.map((g) => {
        const list = items.filter((it) => it.status === g);
        if (list.length === 0) return null;
        const grupSeciliSayisi = list.filter((it) => secililer.has(it.id)).length;
        return (
          <section key={g}>
            <h2 className="font-head font-bold text-sm mb-3 flex items-center gap-2">
              <span className={`pill ${STATUS[g].cls}`}>{STATUS[g].label}</span>
              <span className="text-slate-500">({list.length})</span>
              {g !== 'published' && (
                <button
                  className="text-[11px] text-slate-400 hover:text-red ml-1"
                  onClick={() => grupSecTumu(list)}
                >
                  {grupSeciliSayisi === list.length ? 'seçimi kaldır' : 'tümünü seç'}
                </button>
              )}
            </h2>
            <div className="space-y-3">
              {list.map((it) => (
                <div key={it.id}
                  className={`card p-4 hover:shadow-md transition-shadow ${secililer.has(it.id) ? 'border-red/50 ring-1 ring-red/20' : ''}`}>
                  <div className="flex items-start gap-3">
                    {it.status !== 'published' && (
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0"
                        checked={secililer.has(it.id)}
                        onChange={() => secimDegistir(it.id)}
                        aria-label="seç"
                      />
                    )}
                    <div className="cursor-pointer shrink-0" onClick={() => setSelected(it)}>
                      {it.videoUrl ? (
                        <video src={medyaUrl(it.videoUrl, { kare: true })} muted playsInline preload="metadata"
                          className="w-16 h-16 rounded object-cover border border-line bg-slate-100" />
                      ) : it.imageUrl ? (
                        <img src={it.imageUrl} alt="" loading="lazy"
                          className="w-16 h-16 rounded object-cover border border-line" />
                      ) : (
                        <div className="w-16 h-16 rounded border border-line bg-slate-100 grid place-items-center text-slate-300 text-xs">—</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setSelected(it)}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="pill pill-muted">
                          {PLATFORM_LABEL[it.platform] || it.platform}
                          {it.publishAs ? (it.publishAs === 'organization' ? ' · şirket' : ' · kişisel') : ''}
                        </span>
                        <span className="text-xs text-slate-500">{names[it.slug] || it.slug} · {it.lang?.toUpperCase()}{it.variantId ? ` · ${it.variantId}` : ''}</span>
                        {real.includes(it.platform)
                          ? <span className="text-[10px] text-ok">otomatik yayın</span>
                          : <span className="text-[10px] text-amber">assisted</span>}
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{it.caption || '(metin yok)'}</p>
                    </div>
                  </div>
                  {/* Satır-içi aksiyonlar — artık modal açmaya gerek yok */}
                  <div className="flex items-center gap-2 flex-wrap justify-end mt-3 pt-3 border-t border-line">
                    <Aksiyonlar item={it} busy={busy} real={real} onApprove={approve} onPublish={publish} onMarkPublished={markPublished} onCancel={cancel} onRestore={restore} onRemove={remove} />
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
        real={real}
        onApprove={approve}
        onPublish={publish}
        onMarkPublished={markPublished}
        onCancel={cancel}
        onRestore={restore}
        onRemove={remove}
        onClose={() => setSelected(null)}
      />

      {/* Sticky toplu-işlem çubuğu */}
      {secililer.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 md:left-64 z-40 bg-navy text-white px-4 md:px-10 py-3 flex items-center gap-3 flex-wrap shadow-[0_-8px_24px_rgba(7,23,57,0.25)]">
          <span className="text-sm font-semibold">{secililer.size} öğe seçili</span>
          <button className="btn btn-primary text-sm" disabled={topluIsleniyor} onClick={topluOnayla}>
            {topluIsleniyor ? '…' : '✓ Seçilenleri Onayla'}
          </button>
          <button className="btn btn-ghost text-sm" disabled={topluIsleniyor} onClick={topluIptal}>
            {topluIsleniyor ? '…' : '⏸ Seçilenleri İptal Et'}
          </button>
          <button className="btn btn-ghost text-sm" disabled={topluIsleniyor} onClick={topluKaldir}>
            {topluIsleniyor ? '…' : '🗑 Seçilenleri Sil'}
          </button>
          <button className="text-xs text-white/70 hover:text-white ml-auto" onClick={() => setSecililer(new Set())}>
            seçimi temizle
          </button>
        </div>
      )}
    </div>
  );
}
