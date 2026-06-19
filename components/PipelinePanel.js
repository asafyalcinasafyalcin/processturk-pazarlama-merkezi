'use client';

import { useEffect, useState } from 'react';

const STAGE_META = {
  text: { label: '1 · Metin / Senaryo', icon: '✍️' },
  voice: { label: '2 · Seslendirme', icon: '🎙️' },
  subtitle: { label: '3 · Altyazı', icon: '💬' },
  video: { label: '4 · Video Kurgu', icon: '🎬' },
};
const ORDER = ['text', 'voice', 'subtitle', 'video'];
const LANG_LABEL = { tr: 'TR', en: 'EN', fr: 'FR', ru: 'RU', ar: 'AR' };

export default function PipelinePanel({ slug, languages }) {
  const langs = languages?.length ? languages : ['tr'];
  const [lang, setLang] = useState(langs[0]);
  const [pipe, setPipe] = useState(null);
  const [status, setStatus] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});

  async function load(l = lang) {
    setError(null);
    const res = await fetch(`/api/stage?slug=${slug}&lang=${l}`);
    const data = await res.json();
    if (data.ok) { setPipe(data.pipeline); setStatus(data.status); }
    else setError(data.error);
  }
  useEffect(() => { load(lang); /* eslint-disable-next-line */ }, [lang]);

  async function act(stage, action, extra = {}) {
    setBusy(`${stage}:${action}`); setError(null);
    try {
      const res = await fetch(`/api/stage/${stage}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, lang, action, ...extra }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error + (data.detail ? ` — ${data.detail}` : ''));
      setPipe(data.pipeline); setStatus(data.status); setEditing(false);
    } catch (e) { setError(`${STAGE_META[stage].label}: ${e.message}`); }
    finally { setBusy(null); }
  }

  function StatusBadge({ st }) {
    if (!st) return null;
    if (st.blocked && st.status === 'empty') return <span className="pill pill-muted">üst aşama bekliyor</span>;
    if (st.stale) return <span className="pill pill-amber">güncel değil</span>;
    if (st.status === 'approved') return <span className="pill pill-ok">onaylı</span>;
    if (st.status === 'draft') return <span className="pill pill-amber">taslak</span>;
    return <span className="pill pill-muted">yok</span>;
  }

  const td = pipe?.text?.data;

  return (
    <section className="card p-5 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-head font-bold">Aşamalı Üretim Hattı</h2>
        <div className="flex gap-1.5">
          {langs.map((l) => (
            <button key={l} onClick={() => { setLang(l); setEditing(false); }} className={`pill ${l === lang ? 'pill-ok' : 'pill-muted'}`}>{LANG_LABEL[l] || l}</button>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-4">Her aşama yalnız onaylı üst aşamadan üretilir. Üst aşama değişirse alt aşama “güncel değil” olur ama otomatik yeniden üretilmez (tekrar ücret yok).</p>

      {error && <div className="card p-3 border-red/40 text-red text-sm mb-4">⚠ {error}</div>}

      <div className="space-y-3">
        {ORDER.map((stage) => {
          const st = status[stage];
          const s = pipe?.[stage];
          const isBusy = busy?.startsWith(stage + ':');
          const canGen = !(st?.blocked && st?.status === 'empty');
          return (
            <div key={stage} className="border border-line rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-semibold text-sm">{STAGE_META[stage].icon} {STAGE_META[stage].label}</div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">~${(st?.cost ?? 0).toFixed(3)}</span>
                  <StatusBadge st={st} />
                </div>
              </div>

              {/* önizleme */}
              {stage === 'text' && td && !editing && (
                <div className="text-sm text-slate-600 space-y-1 mb-2">
                  <div><b>Kanca:</b> {td.hook}</div>
                  <div><b>Fayda:</b> {td.benefitB}</div>
                  <div className="text-slate-500"><b>Seslendirme:</b> {td.voiceover}</div>
                </div>
              )}
              {stage === 'text' && editing && (
                <div className="space-y-2 mb-2">
                  <input className="input" value={draft.hook ?? td?.hook ?? ''} onChange={(e) => setDraft({ ...draft, hook: e.target.value })} placeholder="Kanca" />
                  <input className="input" value={draft.benefitB ?? td?.benefitB ?? ''} onChange={(e) => setDraft({ ...draft, benefitB: e.target.value })} placeholder="İkinci fayda" />
                  <textarea className="textarea" rows={3} value={draft.voiceover ?? td?.voiceover ?? ''} onChange={(e) => setDraft({ ...draft, voiceover: e.target.value })} placeholder="Seslendirme metni" />
                </div>
              )}
              {stage === 'voice' && s?.data?.url && <audio src={s.data.url} controls className="w-full my-2" />}
              {stage === 'subtitle' && s?.data?.srt && (
                <a className="text-xs text-red hover:underline" download={`${slug}-${lang}.srt`} href={`data:text/plain;charset=utf-8,${encodeURIComponent(s.data.srt)}`}>⬇ {slug}-{lang}.srt indir ({s.data.cues?.length || 0} satır)</a>
              )}
              {stage === 'video' && s?.data?.url && (
                <video src={s.data.url} controls className="w-full rounded-lg my-2 bg-black" style={{ maxHeight: 420, aspectRatio: '9/16' }} />
              )}

              {/* aksiyonlar */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <button className="btn btn-primary text-sm" disabled={isBusy || !canGen}
                  onClick={() => act(stage, 'generate', stage === 'video' ? { music: true } : {})}>
                  {isBusy ? '…' : s?.status === 'empty' ? 'Üret' : '↻ Yeniden üret'}
                </button>
                {stage === 'text' && s?.status !== 'empty' && !editing && (
                  <button className="btn btn-ghost text-sm" onClick={() => { setEditing(true); setDraft({}); }}>Düzenle</button>
                )}
                {stage === 'text' && editing && (
                  <button className="btn btn-ghost text-sm" disabled={isBusy} onClick={() => act('text', 'edit', { edit: draft })}>💾 Kaydet</button>
                )}
                {stage !== 'subtitle' && s?.status === 'draft' && (
                  <button className="btn btn-ghost text-sm" disabled={isBusy} onClick={() => act(stage, 'approve')}>✓ Onayla</button>
                )}
                {st?.stale && <span className="text-[11px] text-amber">üst aşama değişti — istersen yeniden üret</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
