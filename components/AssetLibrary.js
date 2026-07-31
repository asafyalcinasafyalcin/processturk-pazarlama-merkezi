'use client';

import { useEffect, useState } from 'react';
import { medyaUrl } from '@/lib/medya-url';

const TYPE_LABEL = { gorsel: '🖼️ Görsel', video: '🎬 Video', ses: '🎙️ Ses', metin: '✍️ Metin' };
const TYPE_ORDER = ['all', 'gorsel', 'video', 'ses', 'metin'];

export default function AssetLibrary({ slug }) {
  const [assets, setAssets] = useState([]);
  const [fType, setFType] = useState('all');
  const [fLang, setFLang] = useState('all');
  const [busy, setBusy] = useState(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [calPlatform, setCalPlatform] = useState('instagram');
  const [calBusy, setCalBusy] = useState(false);
  const [calMsg, setCalMsg] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [siteBusy, setSiteBusy] = useState(false);
  const [siteMsg, setSiteMsg] = useState(null);

  async function load() {
    const res = await fetch(`/api/assets?slug=${slug}&includeArchived=1`);
    const d = await res.json();
    if (d.ok) setAssets(d.assets);
  }
  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open]);

  async function remove(a) {
    if (!confirm('Bu içeriği kalıcı olarak silmek istediğine emin misin?')) return;
    setBusy(a.id);
    await fetch('/api/assets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id }) });
    setSelected(null);
    await load();
    setBusy(null);
  }

  // Arşivle / geri getir (silmeden gizle)
  async function archive(a, val) {
    setBusy(a.id);
    await fetch('/api/assets', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, archived: val }) });
    setSelected(null);
    await load();
    setBusy(null);
  }

  // Takvime ekle (onay kapısı: takvimde Asaf onaylar, sonra yayınlanır)
  async function addToCalendar(a) {
    const mediaUrl = a.localPath || a.url;
    if (!mediaUrl && !a.caption) { setCalMsg('Eklenecek medya/metin yok.'); return; }
    setCalBusy(true); setCalMsg(null);
    try {
      const isVideo = a.type === 'video';
      const res = await fetch('/api/calendar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, platform: calPlatform, lang: a.lang || 'tr',
          caption: a.caption || a.text || '',
          videoUrl: isVideo ? mediaUrl : '', imageUrl: isVideo ? '' : (mediaUrl || ''),
        }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setCalMsg('Takvime eklendi → İçerik Takviminde onay gerekir.');
    } catch (e) { setCalMsg('⚠ ' + e.message); }
    finally { setCalBusy(false); }
  }

  // Bu görseli/videoyu SİTENİN medya kütüphanesine gönder (site dosyayı kendisi indirir).
  async function siteyeGonder(a) {
    const mediaUrl = a.localPath || a.url;
    if (!mediaUrl) { setSiteMsg('Gönderilecek medya yok.'); return; }
    setSiteBusy(true); setSiteMsg(null);
    try {
      const res = await fetch('/api/library/push-to-website', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: mediaUrl, ad: a.slug || 'pazarlama', etiket: 'pazarlama-merkezi' }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setSiteMsg('✓ Siteye gönderildi → site medya kütüphanesinde.');
    } catch (e) { setSiteMsg('⚠ ' + e.message); }
    finally { setSiteBusy(false); }
  }

  const langs = [...new Set(assets.map((a) => a.lang))];
  const archivedCount = assets.filter((a) => a.archived).length;
  const shown = assets.filter((a) =>
    (fType === 'all' || a.type === fType) &&
    (fLang === 'all' || a.lang === fLang) &&
    (showArchived ? a.archived : !a.archived));

  return (
    <section className="card p-5 mt-6">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen((o) => !o)}>
        <h2 className="font-head font-bold">📦 Varlık Kütüphanesi <span className="text-xs font-normal text-slate-500">({assets.length || '—'} içerik)</span></h2>
        <span className="text-slate-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4">
          <p className="text-xs text-slate-500 mb-3">Üretilen her görsel/video/ses/metin burada saklanır. Tıklayınca tüm detayını görür, silebilirsin.</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {TYPE_ORDER.map((t) => (
              <button key={t} onClick={() => setFType(t)} className={`pill ${fType === t ? 'pill-ok' : 'pill-muted'}`}>{t === 'all' ? 'Hepsi' : TYPE_LABEL[t]}</button>
            ))}
            {langs.length > 1 && <span className="mx-1 text-slate-300">·</span>}
            {langs.length > 1 && ['all', ...langs].map((l) => (
              <button key={l} onClick={() => setFLang(l)} className={`pill ${fLang === l ? 'pill-ok' : 'pill-muted'}`}>{l === 'all' ? 'Tüm diller' : l.toUpperCase()}</button>
            ))}
            <span className="mx-1 text-slate-300">·</span>
            <button onClick={() => setShowArchived((s) => !s)} className={`pill ${showArchived ? 'pill-ok' : 'pill-muted'}`}>
              🗄 Arşiv{archivedCount > 0 ? ` (${archivedCount})` : ''}
            </button>
          </div>

          {shown.length === 0 && <p className="text-sm text-slate-500">Henüz içerik yok. Görsel / video / metin üretince burada birikir.</p>}

          {/* Grid önizleme — tıklanabilir kartlar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {shown.map((a) => {
              const mediaUrl = a.localPath || a.url;
              return (
                <button key={a.id} onClick={() => { setSelected(a); setCalMsg(null); }}
                  className="border border-line rounded-xl overflow-hidden text-left hover:border-navy/50 hover:shadow-sm transition group">
                  <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                    {a.type === 'gorsel' && mediaUrl ? (
                      <img src={mediaUrl} alt="görsel" className="w-full h-full object-cover" />
                    ) : a.type === 'video' && mediaUrl ? (
                      <video src={medyaUrl(mediaUrl, { kare: true })} className="w-full h-full object-cover bg-slate-100" muted playsInline preload="metadata" />
                    ) : (
                      <span className="text-4xl opacity-40">{(TYPE_LABEL[a.type] || '📄').split(' ')[0]}</span>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="font-semibold">{(TYPE_LABEL[a.type] || a.type)}</span>
                      <span className="pill pill-muted text-[9px]">{(a.lang || 'tr').toUpperCase()}</span>
                      {a.manual && <span className="pill pill-ok text-[9px]">yüklendi</span>}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">{a.concept || a.template || a.platform || ''}</div>
                    <div className="text-[10px] text-slate-500">{new Date(a.at).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Detay modalı */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-line">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">{TYPE_LABEL[selected.type] || selected.type}</span>
                <span className="pill pill-muted text-xs">{(selected.lang || 'tr').toUpperCase()}</span>
                {selected.manual && <span className="pill pill-ok text-xs">manuel yüklendi</span>}
              </div>
              <button className="text-slate-500 hover:text-slate-700 text-xl leading-none" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="p-4 space-y-3">
              {selected.type === 'gorsel' && (selected.localPath || selected.url) && (
                <img src={selected.localPath || selected.url} alt="görsel" className="w-full rounded-xl border border-line" />
              )}
              {selected.type === 'video' && (selected.localPath || selected.url) && (
                <video src={selected.localPath || selected.url} controls className="w-full rounded-xl border border-line bg-black" />
              )}
              {selected.type === 'ses' && (selected.voiceUrl || selected.localPath || selected.url) && (
                <audio src={selected.voiceUrl || selected.localPath || selected.url} controls className="w-full" />
              )}
              {(selected.caption || selected.text) && (
                <div className="whitespace-pre-wrap text-sm text-slate-700 bg-slate-50 rounded-xl p-3 border border-line">
                  {selected.caption || selected.text}
                </div>
              )}
              <dl className="text-xs text-slate-500 space-y-1">
                {selected.concept && <div><span className="text-slate-500">Konsept:</span> {selected.concept}</div>}
                {selected.template && <div><span className="text-slate-500">Şablon:</span> {selected.template}</div>}
                {selected.platform && <div><span className="text-slate-500">Platform:</span> {selected.platform}</div>}
                {selected.imageSource && <div><span className="text-slate-500">Kaynak:</span> {selected.imageSource}</div>}
                {selected.model && <div><span className="text-slate-500">Model:</span> {selected.model}</div>}
                <div><span className="text-slate-500">Tarih:</span> {new Date(selected.at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</div>
              </dl>
            </div>
            {/* Takvime ekle (onay kapısı) */}
            {(selected.type === 'gorsel' || selected.type === 'video') && (
              <div className="px-4 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Takvime ekle:</span>
                  {['instagram', 'linkedin', 'facebook', 'x'].map((p) => (
                    <button key={p} onClick={() => setCalPlatform(p)}
                      className={`pill text-xs ${calPlatform === p ? 'pill-ok' : 'pill-muted'}`}>{p}</button>
                  ))}
                  <button className="btn btn-primary text-xs" disabled={calBusy} onClick={() => addToCalendar(selected)}>
                    {calBusy ? 'Ekleniyor…' : '📅 Takvime Ekle'}
                  </button>
                </div>
                {calMsg && <p className="text-xs text-slate-500 mt-1">{calMsg}</p>}
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-line">
                  <span className="text-xs text-slate-500">Web sitesi:</span>
                  <button className="btn btn-ghost text-xs" disabled={siteBusy} onClick={() => siteyeGonder(selected)}>
                    {siteBusy ? 'Gönderiliyor…' : '🌐 Siteye gönder'}
                  </button>
                </div>
                {siteMsg && <p className="text-xs text-slate-500 mt-1">{siteMsg}</p>}
              </div>
            )}
            <div className="flex items-center gap-2 p-4 border-t border-line">
              {(selected.localPath || selected.url) && (
                <a href={selected.localPath || selected.url} download className="btn btn-ghost text-sm">⬇ İndir</a>
              )}
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
    </section>
  );
}
