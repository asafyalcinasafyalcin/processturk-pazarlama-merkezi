'use client';

import { useState } from 'react';
import { tierSummary, DEFAULT_TIER } from '@/lib/quality-tiers';

const IMAGE_TIER_LIST = tierSummary('image');
const VIDEO_TIER_LIST = tierSummary('video');

export default function AyarlarClient({ initial }) {
  const [settings, setSettings] = useState(initial);
  const [samples, setSamples] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  // telaffuz sözlüğü editörü
  const [dict, setDict] = useState(Object.entries(initial.pronounce || {}));
  const [nk, setNk] = useState(''); const [nv, setNv] = useState('');

  async function genSamples() {
    setBusy(true); setError(null); setMsg(null); setSamples(null);
    try {
      const res = await fetch('/api/voice-samples', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSamples(data);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function pickVoice(s) {
    setError(null); setMsg(null);
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandVoice: s.id, brandPreset: s.preset }),
    });
    const data = await res.json();
    if (data.ok) { setSettings(data.settings); setMsg(`Marka sesi seçildi: ${s.label}`); }
    else setError(data.error);
  }

  async function setMode(mode) {
    setError(null); setMsg(null);
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generationMode: mode }),
    });
    const data = await res.json();
    if (data.ok) { setSettings(data.settings); setMsg(mode === 'manuel' ? 'Üretim modu: Manuel (kredi koruması açık)' : 'Üretim modu: Otomatik'); }
    else setError(data.error);
  }

  async function setTier(key, value) {
    setError(null); setMsg(null);
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    const data = await res.json();
    if (data.ok) { setSettings(data.settings); setMsg(`Varsayılan ${key === 'imageTier' ? 'görsel' : 'video'} kalitesi: ${value}`); }
    else setError(data.error);
  }

  async function saveDict(nextEntries) {
    const obj = Object.fromEntries(nextEntries.filter(([k]) => k));
    const res = await fetch('/api/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pronounce: obj }),
    });
    const data = await res.json();
    if (data.ok) { setSettings(data.settings); setMsg('Telaffuz sözlüğü kaydedildi.'); }
    else setError(data.error);
  }

  return (
    <div className="space-y-6">
      {error && <div className="card p-3 border-red/40 text-red text-sm">⚠ {error}</div>}
      {msg && <div className="card p-3 text-ok text-sm">✓ {msg}</div>}

      {/* Üretim modu — kredi koruması */}
      <section className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-head font-bold">Üretim Modu</h2>
          <span className={`pill ${settings.generationMode === 'otomatik' ? 'pill-amber' : 'pill-ok'}`}>
            {settings.generationMode === 'otomatik' ? 'Otomatik' : 'Manuel (kredi koruması)'}
          </span>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          <strong>Manuel</strong> (önerilen): panel kendiliğinden Higgsfield kredisi yakmaz; otomatik görsel/video üretimi
          açık onay ister. Asıl yol: içeriği Higgsfield'de üretip "Hazır İçerik Ekle" ile getirmek.
          <strong> Otomatik</strong>: üretim butonları doğrudan çalışır (kredi yakar).
        </p>
        <div className="flex gap-2">
          <button className={`btn text-sm ${settings.generationMode !== 'otomatik' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMode('manuel')}>🛡️ Manuel (kredi koruması)</button>
          <button className={`btn text-sm ${settings.generationMode === 'otomatik' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMode('otomatik')}>⚡ Otomatik</button>
        </div>
      </section>

      {/* Varsayılan kalite tier'ı — görsel + video (Asaf: varsayılan PREMIUM) */}
      <section className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-head font-bold">Varsayılan Kalite</h2>
          <span className="pill pill-ok">Görsel: {settings.imageTier || DEFAULT_TIER} · Video: {settings.videoTier || DEFAULT_TIER}</span>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Üretim ekranında ayrıca değiştirilebilir. <strong>Premium</strong> (varsayılan) = en yüksek kalite/çözünürlük,
          en yüksek maliyet. Kredi koruması her tier'da geçerlidir.
        </p>
        <div className="mb-3">
          <span className="label mb-1 block">Görsel kalitesi</span>
          <div className="flex flex-wrap gap-2">
            {IMAGE_TIER_LIST.map((t) => (
              <button key={t.id} onClick={() => setTier('imageTier', t.id)}
                className={`border rounded-xl px-3 py-2 text-left text-xs transition ${
                  (settings.imageTier || DEFAULT_TIER) === t.id ? 'border-navy bg-navy/5 font-semibold' : 'border-line hover:border-slate-400'
                }`}>
                <div>{t.label} <span className="text-slate-500 font-normal">· {t.costLabel}</span></div>
                <div className="text-slate-500 text-[10px]">{t.falModel} / {t.hfModel}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label mb-1 block">Video kalitesi</span>
          <div className="flex flex-wrap gap-2">
            {VIDEO_TIER_LIST.map((t) => (
              <button key={t.id} onClick={() => setTier('videoTier', t.id)}
                className={`border rounded-xl px-3 py-2 text-left text-xs transition ${
                  (settings.videoTier || DEFAULT_TIER) === t.id ? 'border-navy bg-navy/5 font-semibold' : 'border-line hover:border-slate-400'
                }`}>
                <div>{t.label} <span className="text-slate-500 font-normal">· {t.resolution} · {t.costLabel}</span></div>
                <div className="text-slate-500 text-[10px]">{t.falModel} / {t.hfModel}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Marka sesi */}
      <section className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-head font-bold">Marka Sesi</h2>
          <span className="pill pill-ok">Seçili: {settings.brandVoice} · {settings.brandPreset}</span>
        </div>
        <p className="text-sm text-slate-500 mb-4">Aynı cümleyi farklı seslerle dinle, markanın sesini seç. Hedef: kendinden emin, sıcak, enerjik (B2B).</p>
        <button className="btn btn-primary text-sm" onClick={genSamples} disabled={busy}>{busy ? 'Üretiliyor… (~30 sn)' : '🔊 Ses örnekleri üret'}</button>

        {samples && (
          <div className="mt-4 space-y-3">
            <p className="text-[11px] text-slate-500">Okunan: “{samples.spokenText}”</p>
            {samples.samples.map((s) => (
              <div key={s.id} className="flex items-center gap-3 border border-line rounded-xl p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{s.label}</div>
                  {s.url ? <audio src={s.url} controls className="w-full mt-1" /> : <div className="text-xs text-red">{s.error}</div>}
                </div>
                {s.url && <button className="btn btn-ghost text-sm" onClick={() => pickVoice(s)}>Bu sesi seç</button>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Telaffuz sözlüğü */}
      <section className="card p-4 sm:p-5">
        <h2 className="font-head font-bold mb-1">Telaffuz Sözlüğü</h2>
        <p className="text-sm text-slate-500 mb-4">Marka/teknik terimlerin okunuşu (ör. marka adı → yazıldığı gibi okunuş). Seslendirmeden önce uygulanır.</p>
        <div className="space-y-2">
          {dict.map(([k, v], i) => (
            <div key={i} className="flex items-center gap-2">
              <input className="input" value={k} onChange={(e) => { const d = [...dict]; d[i] = [e.target.value, v]; setDict(d); }} placeholder="terim" />
              <span className="text-slate-500">→</span>
              <input className="input" value={v} onChange={(e) => { const d = [...dict]; d[i] = [k, e.target.value]; setDict(d); }} placeholder="okunuş" />
              <button className="text-xs text-slate-500 hover:text-red" onClick={() => { const d = dict.filter((_, j) => j !== i); setDict(d); saveDict(d); }}>sil</button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input className="input" value={nk} onChange={(e) => setNk(e.target.value)} placeholder="yeni terim" />
            <span className="text-slate-500">→</span>
            <input className="input" value={nv} onChange={(e) => setNv(e.target.value)} placeholder="okunuş" />
            <button className="btn btn-ghost text-sm" onClick={() => { if (!nk) return; const d = [...dict, [nk, nv]]; setDict(d); setNk(''); setNv(''); saveDict(d); }}>+ ekle</button>
          </div>
        </div>
        <button className="btn btn-primary text-sm mt-4" onClick={() => saveDict(dict)}>💾 Sözlüğü kaydet</button>
      </section>
    </div>
  );
}
