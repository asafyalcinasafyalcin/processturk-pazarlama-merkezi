'use client';

import { useState, useEffect, useRef } from 'react';
import PipelinePanel from './PipelinePanel';
import AssetLibrary from './AssetLibrary';

const LANG_LABEL = { tr: 'TR', en: 'EN', ar: 'AR', fr: 'FR', ru: 'RU' };
const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' }, { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' }, { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' }, { id: 'x', label: 'X' },
];

export default function UrunDetay({ product, initialContent }) {
  const m = product.marketing || {};
  const langs = m.languages?.length ? m.languages : ['tr', 'en'];
  const [content, setContent] = useState(initialContent || {});
  const [copyBusy, setCopyBusy] = useState(false);
  const [vidBusy, setVidBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [activeVariant, setActiveVariant] = useState('A');
  const [activeLang, setActiveLang] = useState(langs[0]);

  // video seçenekleri
  const [vLang, setVLang] = useState(langs[0]);
  const [vVoice, setVVoice] = useState(true);
  const [vMusic, setVMusic] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  // düzenlenebilir copy (local kopya)
  const [draft, setDraft] = useState(null);
  useEffect(() => { setDraft(content.copy ? JSON.parse(JSON.stringify(content.copy)) : null); }, [content.copy]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  async function genCopy() {
    setCopyBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch('/api/generate/copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.slug, languages: langs }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setContent((c) => ({ ...c, copy: data.copy }));
      setActiveVariant(data.copy.variants?.[0]?.id || 'A');
    } catch (e) { setError('Metin: ' + e.message); }
    finally { setCopyBusy(false); }
  }

  async function saveCopy() {
    if (!draft) return;
    setSaveBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch('/api/content', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.slug, copy: { ...draft, at: new Date().toISOString() } }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setContent((c) => ({ ...c, copy: data.content.copy }));
      setMsg('Metin kaydedildi.');
    } catch (e) { setError('Kaydet: ' + e.message); }
    finally { setSaveBusy(false); }
  }

  async function genVideo() {
    setVidBusy(true); setError(null); setMsg(null); setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    try {
      const res = await fetch('/api/generate/video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.slug, lang: vLang, voice: vVoice, music: vMusic }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error + (data.detail ? ` (${data.detail})` : ''));
      setContent((c) => ({ ...c, video: data.video, scriptPlan: data.plan }));
      setMsg(`Video hazır (${data.imageSource === 'real' ? 'gerçek ürün görseli' : 'AI görsel'}).`);
    } catch (e) { setError('Video: ' + e.message); }
    finally { setVidBusy(false); clearInterval(timerRef.current); }
  }

  // ── Yayına ekle ──
  const [platforms, setPlatforms] = useState(['instagram', 'tiktok']);
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState(null);
  const togglePlatform = (id) => setPlatforms((ps) => ps.includes(id) ? ps.filter((x) => x !== id) : [...ps, id]);

  const variant = draft?.variants?.find((v) => v.id === activeVariant) || draft?.variants?.[0];
  const langData = variant?.by_lang?.[activeLang];

  function editField(field, value) {
    setDraft((d) => {
      const copy = JSON.parse(JSON.stringify(d));
      const v = copy.variants.find((x) => x.id === (variant?.id));
      if (v) v.by_lang[activeLang][field] = value;
      return copy;
    });
  }

  async function addToCalendar() {
    if (!langData) { setAddMsg('Önce metin üret.'); return; }
    setAddBusy(true); setAddMsg(null);
    const caption = [langData.headline, '', langData.primary, langData.description].filter(Boolean).join('\n');
    try {
      for (const platform of platforms) {
        await fetch('/api/calendar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: product.slug, platform, lang: activeLang, variantId: activeVariant, caption, videoUrl: content.video?.url || '' }),
        });
      }
      setAddMsg(`${platforms.length} gönderi taslak olarak eklendi → İçerik Takvimi'nde onayla.`);
    } catch (e) { setAddMsg('Hata: ' + e.message); }
    finally { setAddBusy(false); }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="font-head font-extrabold text-2xl md:text-3xl">{m.name_tr || product.name_en}</h1>
          <div className="text-slate-500 text-sm mt-1">{product.category}{product.specs?.capacity ? ` · ${product.specs.capacity}` : ''}</div>
        </div>
      </div>

      {error && <div className="card p-3 border-red/40 text-red text-sm mb-4">⚠ {error}</div>}
      {msg && <div className="card p-3 text-ok text-sm mb-4">✓ {msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sol: Düzenlenebilir reklam metni */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-head font-bold">Reklam Metni <span className="text-xs font-normal text-slate-400">(düzenlenebilir)</span></h2>
            <button className="btn btn-primary text-sm" onClick={genCopy} disabled={copyBusy}>
              {copyBusy ? 'Üretiliyor…' : draft ? '↻ Yeniden üret' : '✍ Metin üret'}
            </button>
          </div>

          {draft?.highlights?.length > 0 && (
            <div className="mb-3">
              <div className="label">Öne çıkan özellikler (AI önerisi)</div>
              <div className="flex flex-wrap gap-1.5">{draft.highlights.map((h, i) => <span key={i} className="pill pill-ok">{h}</span>)}</div>
            </div>
          )}

          {!draft && <p className="text-slate-500 text-sm">Henüz metin yok. Harekete geçirici, fiyatsız, özellik-kancalı 4 varyant üretilecek.</p>}

          {draft && (
            <>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {draft.variants.map((v) => (
                  <button key={v.id} onClick={() => setActiveVariant(v.id)} className={`pill ${v.id === activeVariant ? 'pill-active' : 'pill-muted'}`} title={v.angle}>{v.id} · {v.angle}</button>
                ))}
              </div>
              <div className="flex gap-1.5 mb-3">
                {(draft.languages || langs).map((l) => (
                  <button key={l} onClick={() => setActiveLang(l)} className={`pill ${l === activeLang ? 'pill-active' : 'pill-muted'}`}>{LANG_LABEL[l] || l}</button>
                ))}
              </div>
              {langData ? (
                <div className="space-y-3">
                  <div><label className="label">Headline</label><input className="input num" value={langData.headline || ''} onChange={(e) => editField('headline', e.target.value)} /></div>
                  <div><label className="label">Primary</label><textarea className="textarea" rows={3} value={langData.primary || ''} onChange={(e) => editField('primary', e.target.value)} /></div>
                  <div><label className="label">Description</label><input className="input" value={langData.description || ''} onChange={(e) => editField('description', e.target.value)} /></div>
                  <div><label className="label">CTA</label><input className="input" value={langData.cta || ''} onChange={(e) => editField('cta', e.target.value)} /></div>
                  <button className="btn btn-ghost text-sm" onClick={saveCopy} disabled={saveBusy}>{saveBusy ? 'Kaydediliyor…' : '💾 Düzenlemeyi kaydet'}</button>
                </div>
              ) : <p className="text-slate-500 text-sm">Bu dil için veri yok.</p>}
            </>
          )}
        </section>

        {/* Sağ: Video */}
        <section className="card p-5">
          <h2 className="font-head font-bold mb-3">Tanıtım Videosu <span className="text-xs font-normal text-slate-400">(~20 sn, 9:16)</span></h2>

          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div><label className="label">Dil</label>
              <select className="select" value={vLang} onChange={(e) => setVLang(e.target.value)} style={{ width: 'auto' }}>
                {langs.map((l) => <option key={l} value={l}>{LANG_LABEL[l] || l}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={vVoice} onChange={(e) => setVVoice(e.target.checked)} /> Seslendirme</label>
            <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={vMusic} onChange={(e) => setVMusic(e.target.checked)} /> Müzik</label>
          </div>
          <button className="btn btn-primary text-sm w-full" onClick={genVideo} disabled={vidBusy}>
            {vidBusy ? `Üretiliyor… ${elapsed}s (≈3-5 dk)` : content.video ? '↻ Videoyu yeniden üret' : '🎬 Video üret'}
          </button>
          <p className="text-[11px] text-slate-400 mt-1">Gerçek ürün görseli → hareket + logo intro/outro + teknik özellik kartı + altyazı. Fiyat YOK.</p>

          {vidBusy && <div className="mt-4 text-slate-500 text-sm animate-pulse">Senaryo → görsel → klip → seslendirme → müzik → render…</div>}

          {content.video?.url && !vidBusy && (
            <div className="mt-4 space-y-2">
              <video src={content.video.url} controls className="w-full rounded-xl border border-line bg-black max-h-[460px]" style={{ aspectRatio: '9/16' }} />
              <div className="text-[11px] text-slate-400">
                {content.video.durationSec?.toFixed?.(0)}s · {content.video.lang?.toUpperCase()} · {content.video.imageSource === 'real' ? 'gerçek görsel' : 'AI görsel'}
                {content.video.voice ? ' · sesli' : ''}{content.video.music ? ' · müzikli' : ''}
              </div>
              <a href={content.video.url} target="_blank" rel="noreferrer" className="btn btn-ghost text-sm">⬇ İndir / aç</a>
            </div>
          )}
        </section>
      </div>

      {/* Aşamalı üretim hattı (Faz 2) */}
      <PipelinePanel slug={product.slug} languages={langs} />

      {/* Varlık Kütüphanesi (Faz 3) */}
      <AssetLibrary slug={product.slug} />

      {/* Yayına Hazırla */}
      <section className="card p-5 mt-6">
        <h2 className="font-head font-bold mb-1">Yayına Hazırla</h2>
        <p className="text-xs text-slate-500 mb-4">Seçili varyant (<b>{activeVariant}</b>) + dil (<b>{activeLang.toUpperCase()}</b>) ile platformları seçip takvime <b>taslak</b> ekle. Yayın için takvimde <b>onay</b> gerekir.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {PLATFORMS.map((pl) => (
            <button key={pl.id} onClick={() => togglePlatform(pl.id)} className={`pill ${platforms.includes(pl.id) ? 'pill-active' : 'pill-muted'}`}>{pl.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-primary text-sm" onClick={addToCalendar} disabled={addBusy || !langData || platforms.length === 0}>{addBusy ? 'Ekleniyor…' : '🗓️ Takvime ekle (taslak)'}</button>
          {addMsg && <span className="text-xs text-slate-600">{addMsg}</span>}
        </div>
      </section>
    </div>
  );
}
