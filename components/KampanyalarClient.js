'use client';

import { useState } from 'react';

const LANGS = [{ id: 'tr', l: 'TR' }, { id: 'en', l: 'EN' }, { id: 'ar', l: 'AR' }, { id: 'fr', l: 'FR' }, { id: 'ru', l: 'RU' }];

export default function KampanyalarClient({ products }) {
  const [slug, setSlug] = useState(products[0]?.slug || '');
  const [langs, setLangs] = useState(['en']);
  const [daily, setDaily] = useState(6);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState(null);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState(null);

  const selected = products.find((p) => p.slug === slug);
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
    if (!window.confirm(`CANLI reklam hesabında PAUSED kampanya kurulacak (harcama YOK).\n\nÜrün: ${selected?.name}\nDiller: ${langs.join(', ')}\nBütçe: ${daily} TRY/gün/ad set\n\nVideo Meta'ya yüklenecek (~1-2 dk). Onaylıyor musun?`)) return;
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
    <div className="space-y-6">
      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Ürün</label>
          <select className="select" value={slug} onChange={(e) => setSlug(e.target.value)}>
            {products.map((p) => (
              <option key={p.slug} value={p.slug}>{p.name} — {p.price} {p.hasVideo ? '· 🎬' : ''}{p.hasCopy ? ' ✍' : ''}</option>
            ))}
          </select>
          {selected && !selected.hasVideo && <p className="text-[11px] text-amber mt-1">⚠ Bu ürünün videosu yok — önce ürün detayından video üret (statik creative ile de plan kurulur).</p>}
          {selected && !selected.hasCopy && <p className="text-[11px] text-amber mt-1">⚠ Reklam metni yok — önce metin üret (boş metinle plan yine de kurulur).</p>}
        </div>
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
            <label className="label">Günlük bütçe (USD / ad set)</label>
            <input className="input num" type="number" value={daily} onChange={(e) => setDaily(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={buildPlan} disabled={busy || langs.length === 0}>
          {busy ? 'Plan üretiliyor…' : '📋 Kampanya planı üret (dry-run)'}
        </button>
        {error && <div className="text-red text-sm">⚠ {error}</div>}
      </div>

      {plan && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-head font-bold">{plan.campaign.name}</h2>
            <span className="pill pill-amber">{plan.campaign.status}</span>
          </div>
          <div className="text-sm text-slate-600">
            Hedef: {plan.campaign.objective} · Ürün: <b>{plan.product.name}</b> ({plan.product.price}) · Etiket: <span className="num text-red">{plan.reklam_tag}</span>
          </div>

          {plan.ad_sets.map((a, i) => (
            <div key={i} className="border border-line rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <b className="text-sm">{a.name}</b>
                <span className="text-xs text-slate-400">{a.geo.join(', ')} · ${a.daily_budget_usd}/gün</span>
              </div>
              <div className="text-xs text-slate-400 mb-1">Creative: <b>{a.creative.type}</b> · {a.creative.headline}</div>
              {a.creative.primary_text && <p className="text-sm text-slate-600 whitespace-pre-line">{a.creative.primary_text}</p>}
              <div className="flex flex-wrap gap-3 mt-2 text-xs">
                {a.creative.video_url && <a href={a.creative.video_url} target="_blank" rel="noreferrer" className="text-red hover:underline">🎬 video</a>}
                <a href={a.creative.whatsapp_link} target="_blank" rel="noreferrer" className="text-ok hover:underline">📱 WhatsApp linki</a>
              </div>
            </div>
          ))}

          <ul className="text-[11px] text-slate-500 list-disc pl-4 space-y-1">
            {plan.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>

          <div className="pt-3 border-t border-line">
            <button className="btn btn-primary text-sm" onClick={createReal} disabled={busy}>
              {busy ? 'Kuruluyor…' : '✅ Gerçek kampanyayı kur (PAUSED, harcama yok)'}
            </button>
            <p className="text-[11px] text-slate-500 mt-1">Canlı reklam hesabına PAUSED kampanya yazar; yayını Ads Manager'da sen başlatırsın.</p>
          </div>
        </div>
      )}

      {created && (
        <div className="card p-5 border-ok/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="pill pill-ok">KURULDU · PAUSED</span>
            <span className="text-sm text-slate-600">Kampanya ID: <span className="num">{created.campaign_id}</span></span>
          </div>
          <div className="text-sm text-slate-600">Video ID: <span className="num">{created.video_id}</span></div>
          <ul className="text-xs text-slate-400 mt-2 space-y-1">
            {created.ad_sets.map((a, i) => <li key={i}>{a.lang.toUpperCase()} · {a.geo.join(',')} · adset {a.adset_id} · ad {a.ad_id}</li>)}
          </ul>
          <p className="text-[11px] text-amber mt-3">Ads Manager → ProcessTürk I 2025 → kampanyayı kontrol et, hazırsan yayınla.</p>
        </div>
      )}
    </div>
  );
}
