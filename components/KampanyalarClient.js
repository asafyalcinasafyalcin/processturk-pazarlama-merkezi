'use client';

import { useState, useEffect, useCallback } from 'react';

const LANGS = [{ id: 'tr', l: 'TR' }, { id: 'en', l: 'EN' }, { id: 'ar', l: 'AR' }, { id: 'fr', l: 'FR' }, { id: 'ru', l: 'RU' }];
const SIZES = ['feed', 'story', 'square'];

function Chip({ ok, children }) {
  return <span className={`pill ${ok ? 'pill-ok' : 'pill-muted'}`}>{ok ? '✓' : '○'} {children}</span>;
}

export default function KampanyalarClient({ products }) {
  const [slug, setSlug] = useState(products[0]?.slug || '');
  const selected = products.find((p) => p.slug === slug);

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <label className="label">Ürün</label>
        <select className="select" value={slug} onChange={(e) => setSlug(e.target.value)}>
          {products.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name} — {p.price}
              {p.hasConfig ? ' · 🎨' : ''}{p.hasVideo ? ' · 🎬' : ''}{p.hasCopy ? ' · ✍' : ''}
            </option>
          ))}
        </select>
        {selected && (
          <div className="flex flex-wrap gap-2 mt-3">
            <Chip ok={selected.hasConfig}>Creative config</Chip>
            <Chip ok={selected.hasVideo}>Video</Chip>
            <Chip ok={selected.hasCopy}>İçerik metni</Chip>
          </div>
        )}
      </div>

      {selected && (
        <>
          <TargetingSection key={`t-${slug}`} slug={slug} />
          <CreativeSection key={`c-${slug}`} slug={slug} />
          <SetupSection key={`s-${slug}`} product={selected} />
          <ReportSection />
        </>
      )}
    </div>
  );
}

/* ---------------- 🎯 Hedefleme ---------------- */
function TargetingSection({ slug }) {
  const [adsets, setAdsets] = useState([]);
  const [languages, setLanguages] = useState({});
  const [hasConfig, setHasConfig] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/targeting?slug=${slug}`);
    const d = await res.json();
    setHasConfig(d.hasConfig);
    setAdsets(d.adsets || []);
    setLanguages(d.languages || {});
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  const update = (i, k, v) => setAdsets((a) => a.map((row, j) => j === i ? { ...row, [k]: v } : row));
  const addRow = () => setAdsets((a) => [...a, { lang: 'en', countries: ['NG'], concept: 'a' }]);
  const delRow = (i) => setAdsets((a) => a.filter((_, j) => j !== i));

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const payload = adsets.map((a) => ({
        ...a, countries: Array.isArray(a.countries) ? a.countries : String(a.countries).split(',').map((x) => x.trim()),
      }));
      const res = await fetch('/api/targeting', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, adsets: payload }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setAdsets(d.adsets);
      setMsg('Kaydedildi ✓');
    } catch (e) { setMsg('⚠ ' + e.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="card p-5 space-y-3">
      <h2 className="font-head font-bold">🎯 Hedefleme</h2>
      {!hasConfig && <p className="text-sm text-amber">⚠ Bu ürünün creative config'i yok; hedefleme kaydedilemez.</p>}
      <p className="text-xs text-slate-400">Her satır = bir ad set. Dil = mesaj dili; ülkeler virgülle (ISO-2, ör. NG, GH). Konsept: a = fiyat odaklı, b = kalite odaklı.</p>
      <div className="space-y-2">
        {adsets.map((a, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 border border-line rounded-lg p-2">
            <select className="select w-20" value={a.lang} onChange={(e) => update(i, 'lang', e.target.value)}>
              {LANGS.map((x) => <option key={x.id} value={x.id}>{x.l}</option>)}
            </select>
            <input className="input flex-1 min-w-[140px]" value={Array.isArray(a.countries) ? a.countries.join(', ') : a.countries}
              onChange={(e) => update(i, 'countries', e.target.value.split(',').map((x) => x.trim()))} placeholder="NG, GH, KE" />
            <select className="select w-28" value={a.concept} onChange={(e) => update(i, 'concept', e.target.value)}>
              <option value="a">konsept a</option>
              <option value="b">konsept b</option>
            </select>
            <button className="btn btn-ghost text-xs" onClick={() => delRow(i)}>sil</button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-ghost text-sm" onClick={addRow} disabled={!hasConfig}>+ ad set ekle</button>
        <button className="btn btn-primary text-sm" onClick={save} disabled={busy || !hasConfig}>{busy ? 'Kaydediliyor…' : 'Hedeflemeyi kaydet'}</button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>

      {Object.keys(languages).length > 0 && (
        <details className="mt-2">
          <summary className="text-sm text-slate-500 cursor-pointer">✍️ Reklam metni (creative üzerindeki) — diller</summary>
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            {Object.entries(languages).map(([lng, b]) => (
              <div key={lng} className="border border-line rounded-lg p-3 text-xs">
                <div className="font-bold mb-1">{lng.toUpperCase()} · {b.name}</div>
                <div className="text-slate-500">{b.price_pre} <b className="text-red">{b.price_num}</b></div>
                <div className="text-slate-500 mt-1">{b.sub}</div>
                <div className="flex flex-wrap gap-1 mt-1">{(b.badges || []).map((x, k) => <span key={k} className="pill pill-muted">{x}</span>)}</div>
                <div className="text-slate-400 mt-1">CTA: {b.cta}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Metin düzenleme şu an config dosyasında; sonraki sürümde buradan editlenecek.</p>
        </details>
      )}
    </section>
  );
}

/* ---------------- 🎨 Creative ---------------- */
function CreativeSection({ slug }) {
  const [creatives, setCreatives] = useState([]);
  const [hasConfig, setHasConfig] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [log, setLog] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/creative?slug=${slug}`);
    const d = await res.json();
    setHasConfig(d.hasConfig);
    setCreatives(d.creatives || []);
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  async function regenerate() {
    if (!window.confirm('Creative görselleri yeniden üretilecek (mevcut cutout varsa fal kullanılmaz, sadece marka overlay render edilir). Devam?')) return;
    setBusy(true); setErr(null); setLog(null);
    try {
      const res = await fetch('/api/creative', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setCreatives(d.creatives || []);
      setLog(d.log);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-head font-bold">🎨 Creative ({creatives.length})</h2>
        <button className="btn btn-ghost text-sm" onClick={regenerate} disabled={busy || !hasConfig}>{busy ? 'Üretiliyor…' : '↻ Yeniden üret'}</button>
      </div>
      {!hasConfig && <p className="text-sm text-amber">⚠ Creative config yok; üretilemez. (HD foto + config gerekir.)</p>}
      {err && <div className="text-red text-sm">⚠ {err}</div>}
      {creatives.length === 0 && hasConfig && <p className="text-sm text-slate-400">Henüz creative yok — “Yeniden üret”e bas.</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {creatives.map((c) => (
          <a key={c.rel} href={`/api/creative-image/${c.rel}`} target="_blank" rel="noreferrer" className="block group">
            <img src={`/api/creative-image/${c.rel}`} alt={c.file} loading="lazy"
              className="w-full rounded-lg border border-line object-cover aspect-[4/5] group-hover:opacity-90" />
            <div className="text-[10px] text-slate-400 mt-1 truncate">
              {c.lang !== '—' && <span className="uppercase">{c.lang}</span>} {c.variant === 'b' ? '· B' : ''} · {c.size}
            </div>
          </a>
        ))}
      </div>
      {log && <pre className="text-[10px] text-slate-400 bg-slate-50 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">{log}</pre>}
    </section>
  );
}

/* ---------------- 🚀 Kurulum (plan + PAUSED kur) ---------------- */
function SetupSection({ product }) {
  const slug = product.slug;
  const [langs, setLangs] = useState(['en']);
  const [daily, setDaily] = useState(6);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState(null);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState(null);

  const toggleLang = (id) => setLangs((ls) => ls.includes(id) ? ls.filter((x) => x !== id) : [...ls, id]);

  async function buildPlan() {
    setBusy(true); setError(null); setPlan(null); setCreated(null);
    try {
      const res = await fetch('/api/campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, langs, daily: Number(daily) }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setPlan(data.plan);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function createReal() {
    if (!window.confirm(`CANLI reklam hesabında PAUSED kampanya kurulacak (harcama YOK).\n\nÜrün: ${product.name}\nDiller: ${langs.join(', ')}\nBütçe: ${daily}/gün/ad set\n\nOnaylıyor musun?`)) return;
    setBusy(true); setError(null); setCreated(null);
    try {
      const res = await fetch('/api/campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, langs, daily: Number(daily), mode: 'create' }),
      });
      const data = await res.json();
      if (!data.ok || data.plan?.ok === false) throw new Error(data.plan?.error || data.error);
      setCreated(data.plan);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="card p-5 space-y-4">
      <h2 className="font-head font-bold">🚀 Kurulum</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Diller (= hedef coğrafya)</label>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((x) => (
              <button key={x.id} onClick={() => toggleLang(x.id)} className={`pill ${langs.includes(x.id) ? 'pill-ok' : 'pill-muted'}`}>{x.l}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Günlük bütçe (/ ad set)</label>
          <input className="input num" type="number" value={daily} onChange={(e) => setDaily(e.target.value)} />
        </div>
      </div>
      <button className="btn btn-primary" onClick={buildPlan} disabled={busy || langs.length === 0}>
        {busy ? 'Çalışıyor…' : '📋 Kampanya planı üret (dry-run)'}
      </button>
      {error && <div className="text-red text-sm">⚠ {error}</div>}

      {plan && (
        <div className="border-t border-line pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <b className="text-sm">{plan.campaign.name}</b>
            <span className="pill pill-amber">{plan.campaign.status}</span>
          </div>
          <div className="text-xs text-slate-500">Hedef: {plan.campaign.objective} · {plan.product.name} ({plan.product.price}) · <span className="num text-red">{plan.reklam_tag}</span></div>
          {plan.ad_sets.map((a, i) => (
            <div key={i} className="border border-line rounded-lg p-3">
              <div className="flex items-center justify-between mb-1"><b className="text-xs">{a.name}</b><span className="text-[11px] text-slate-400">{a.geo.join(', ')} · {a.daily_budget_usd}/gün</span></div>
              {a.creative.primary_text && <p className="text-xs text-slate-600 whitespace-pre-line">{a.creative.primary_text}</p>}
              <div className="flex flex-wrap gap-3 mt-1 text-[11px]">
                {a.creative.video_url && <a href={a.creative.video_url} target="_blank" rel="noreferrer" className="text-red hover:underline">🎬 video</a>}
                <a href={a.creative.whatsapp_link} target="_blank" rel="noreferrer" className="text-ok hover:underline">📱 WhatsApp</a>
              </div>
            </div>
          ))}
          <button className="btn btn-primary text-sm" onClick={createReal} disabled={busy}>
            {busy ? 'Kuruluyor…' : '✅ Gerçek kampanyayı kur (PAUSED, harcama yok)'}
          </button>
          <p className="text-[11px] text-slate-500">Canlı hesaba PAUSED yazar; yayını Ads Manager'da sen başlatırsın.</p>
        </div>
      )}

      {created && (
        <div className="border-t border-line pt-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="pill pill-ok">KURULDU · PAUSED</span>
            <span className="text-xs text-slate-600">ID: <span className="num">{created.campaign_id}</span></span>
          </div>
          <ul className="text-[11px] text-slate-400 mt-1 space-y-1">
            {created.ad_sets.map((a, i) => <li key={i}>{a.lang.toUpperCase()} · {a.geo.join(',')} · adset {a.adset_id} · ad {a.ad_id}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ---------------- 📊 Rapor ---------------- */
function ReportSection() {
  const [preset, setPreset] = useState('last_7d');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  async function run() {
    setBusy(true); setErr(null); setData(null);
    try {
      const res = await fetch('/api/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setData(d);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-head font-bold">📊 Performans Raporu</h2>
        <div className="flex items-center gap-2">
          <select className="select w-32" value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="last_7d">Son 7 gün</option>
            <option value="last_30d">Son 30 gün</option>
            <option value="maximum">Tüm zaman</option>
          </select>
          <button className="btn btn-primary text-sm" onClick={run} disabled={busy}>{busy ? 'Çekiliyor…' : 'Rapor çek'}</button>
        </div>
      </div>
      <p className="text-xs text-slate-400">READ-ONLY Meta Insights. PAUSED kampanyada veri boş gelir (normal); yayında dolar.</p>
      {err && <div className="text-red text-sm">⚠ {err}</div>}
      {data && data.summary?.length === 0 && <p className="text-sm text-slate-500">Veri yok — kampanyalar henüz yayında değil. ({data.total_rows} arşiv satırı)</p>}
      {data && data.summary?.length > 0 && (
        <table className="w-full text-xs">
          <thead><tr className="text-slate-400 text-left border-b border-line">
            <th className="py-1">Reklam</th><th className="text-right">Harcama</th><th className="text-right">Gösterim</th><th className="text-right">Sohbet</th><th className="text-right">CPL</th>
          </tr></thead>
          <tbody>
            {data.summary.map((r) => (
              <tr key={r.ad} className="border-b border-line/50">
                <td className="py-1 truncate max-w-[200px]">{r.ad}</td>
                <td className="text-right num">{r.spend}</td>
                <td className="text-right num">{r.impressions}</td>
                <td className="text-right num">{r.conversations}</td>
                <td className="text-right num text-red">{r.cpl ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
