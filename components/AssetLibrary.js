'use client';

import { useEffect, useState } from 'react';

const STAGE_LABEL = { text: '✍️ Metin', voice: '🎙️ Ses', subtitle: '💬 Altyazı', video: '🎬 Video', gorsel: '🖼️ Görsel' };

export default function AssetLibrary({ slug }) {
  const [assets, setAssets] = useState([]);
  const [fType, setFType] = useState('all');
  const [fLang, setFLang] = useState('all');
  const [busy, setBusy] = useState(null);
  const [open, setOpen] = useState(false);

  async function load() {
    const res = await fetch(`/api/assets?slug=${slug}`);
    const d = await res.json();
    if (d.ok) setAssets(d.assets);
  }
  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open]);

  async function restore(a) {
    setBusy(a.vid);
    await fetch('/api/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, lang: a.lang, stage: a.stage, vid: a.vid }) });
    await load(); setBusy(null);
  }

  const langs = [...new Set(assets.map((a) => a.lang))];
  const shown = assets.filter((a) => (fType === 'all' || a.stage === fType) && (fLang === 'all' || a.lang === fLang));

  return (
    <section className="card p-5 mt-6">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen((o) => !o)}>
        <h2 className="font-head font-bold">📦 Varlık Kütüphanesi <span className="text-xs font-normal text-slate-400">({assets.length || '—'} sürüm)</span></h2>
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4">
          <p className="text-xs text-slate-500 mb-3">Üretilen her metin/ses/altyazı/video sürümü saklanır — hiçbiri silinmez. Eski sürümü geri yükleyebilir, indirebilirsin.</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {['all', 'gorsel', 'text', 'voice', 'subtitle', 'video'].map((t) => (
              <button key={t} onClick={() => setFType(t)} className={`pill ${fType === t ? 'pill-ok' : 'pill-muted'}`}>{t === 'all' ? 'Hepsi' : STAGE_LABEL[t]}</button>
            ))}
            {langs.length > 1 && <span className="mx-1 text-slate-300">·</span>}
            {langs.length > 1 && ['all', ...langs].map((l) => (
              <button key={l} onClick={() => setFLang(l)} className={`pill ${fLang === l ? 'pill-ok' : 'pill-muted'}`}>{l === 'all' ? 'Tüm diller' : l.toUpperCase()}</button>
            ))}
          </div>

          {shown.length === 0 && <p className="text-sm text-slate-500">Henüz varlık yok. Aşamalı üretim hattından üret.</p>}

          <div className="space-y-2">
            {shown.map((a) => {
              // localPath öncelikli — CDN URL expire olabilir
              const mediaUrl = a.localPath || a.url;
              return (
                <div key={a.vid} className="border border-line rounded-xl p-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="font-semibold">{STAGE_LABEL[a.stage]}</span>
                      <span className="pill pill-muted">{a.lang.toUpperCase()}</span>
                      {a.isCurrent && <span className="pill pill-ok">güncel</span>}
                      {a.localPath && <span className="pill pill-ok text-[10px]">yerel kopya</span>}
                      {a.note && <span className="text-slate-400">{a.note}</span>}
                      <span className="text-slate-400 ml-auto">{new Date(a.at).toLocaleString('tr-TR')} · ~${(a.cost || 0).toFixed(3)}</span>
                    </div>
                    {a.summary && <div className="text-sm text-slate-600 mt-1 truncate">{a.summary}</div>}
                    {mediaUrl && a.stage === 'gorsel' && (
                      <img src={mediaUrl} alt="görsel" className="mt-1 max-h-32 rounded object-contain border border-line" />
                    )}
                    {mediaUrl && a.stage === 'voice' && <audio src={mediaUrl} controls className="w-full mt-1 h-8" />}
                    {mediaUrl && a.stage === 'video' && (
                      <div className="flex gap-2 mt-1">
                        <a href={mediaUrl} target="_blank" rel="noreferrer" className="text-xs text-red hover:underline">🎬 videoyu aç</a>
                        <a href={mediaUrl} download className="text-xs text-slate-500 hover:underline">⬇ indir</a>
                      </div>
                    )}
                    {a.stage === 'subtitle' && <span className="text-xs text-slate-500">{a.cues} satır</span>}
                  </div>
                  {!a.isCurrent && (
                    <button className="btn btn-ghost text-xs shrink-0" disabled={busy === a.vid} onClick={() => restore(a)}>
                      {busy === a.vid ? '…' : 'Bu sürümü kullan'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
