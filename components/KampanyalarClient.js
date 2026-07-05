'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOnayModal } from './OnayModal';

const LANGS = [{ id: 'tr', l: 'TR' }, { id: 'en', l: 'EN' }, { id: 'ar', l: 'AR' }, { id: 'fr', l: 'FR' }, { id: 'ru', l: 'RU' }];
const SIZES = ['feed', 'story', 'square'];

// Kullanıcı dostu ülke listesi — ISO kodu gizli, isim + bayrak gösterilir
const COUNTRY_LIST = [
  { code: 'TR', name: 'Türkiye', flag: '🇹🇷' },
  { code: 'DE', name: 'Almanya', flag: '🇩🇪' },
  { code: 'FR', name: 'Fransa', flag: '🇫🇷' },
  { code: 'GB', name: 'İngiltere', flag: '🇬🇧' },
  { code: 'NL', name: 'Hollanda', flag: '🇳🇱' },
  { code: 'BE', name: 'Belçika', flag: '🇧🇪' },
  { code: 'SA', name: 'Suudi Arabistan', flag: '🇸🇦' },
  { code: 'AE', name: 'BAE (Dubai)', flag: '🇦🇪' },
  { code: 'EG', name: 'Mısır', flag: '🇪🇬' },
  { code: 'MA', name: 'Fas', flag: '🇲🇦' },
  { code: 'DZ', name: 'Cezayir', flag: '🇩🇿' },
  { code: 'TN', name: 'Tunus', flag: '🇹🇳' },
  { code: 'IQ', name: 'Irak', flag: '🇮🇶' },
  { code: 'KW', name: 'Kuveyt', flag: '🇰🇼' },
  { code: 'QA', name: 'Katar', flag: '🇶🇦' },
  { code: 'JO', name: 'Ürdün', flag: '🇯🇴' },
  { code: 'NG', name: 'Nijerya', flag: '🇳🇬' },
  { code: 'GH', name: 'Gana', flag: '🇬🇭' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'ET', name: 'Etiyopya', flag: '🇪🇹' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳' },
  { code: 'CI', name: 'Fildişi Sahili', flag: '🇨🇮' },
  { code: 'CM', name: 'Kamerun', flag: '🇨🇲' },
  { code: 'TZ', name: 'Tanzanya', flag: '🇹🇿' },
  { code: 'AZ', name: 'Azerbaycan', flag: '🇦🇿' },
  { code: 'UZ', name: 'Özbekistan', flag: '🇺🇿' },
  { code: 'KZ', name: 'Kazakistan', flag: '🇰🇿' },
  { code: 'RU', name: 'Rusya', flag: '🇷🇺' },
  { code: 'UA', name: 'Ukrayna', flag: '🇺🇦' },
  { code: 'RO', name: 'Romanya', flag: '🇷🇴' },
  { code: 'PL', name: 'Polonya', flag: '🇵🇱' },
  { code: 'US', name: 'Amerika', flag: '🇺🇸' },
  { code: 'CA', name: 'Kanada', flag: '🇨🇦' },
  { code: 'IN', name: 'Hindistan', flag: '🇮🇳' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladeş', flag: '🇧🇩' },
  { code: 'ID', name: 'Endonezya', flag: '🇮🇩' },
  { code: 'MY', name: 'Malezya', flag: '🇲🇾' },
  { code: 'BR', name: 'Brezilya', flag: '🇧🇷' },
  { code: 'MX', name: 'Meksika', flag: '🇲🇽' },
];

// Hedef Müşteri — çoklu seçim destekli
const CONCEPT_OPTIONS = [
  { id: 'a', label: 'Gıda Üreticisi',           desc: 'Fabrika, atölye, paketleme tesisi' },
  { id: 'b', label: 'İhracatçı / Distribütör',   desc: 'Makineyi yurt dışına satanlar' },
  { id: 'c', label: 'Sanayi Tesisi',             desc: 'Kimya, tarım, maden sektörü' },
  { id: 'd', label: 'Ambalaj Tesisi',            desc: 'Özel ambalaj ve dolum hizmeti' },
  { id: 'e', label: 'Yatırımcı / Ortak',         desc: 'Makine sektörüne yatırım yapanlar' },
  { id: 'f', label: 'Karar Verici / Yetkili',    desc: 'Satın alma müdürü, fabrika direktörü' },
  { id: 'g', label: 'Sektör Temsilcisi',         desc: 'Dernek, oda, distribütör ağı' },
];

// Hazır ülke grupları
const COUNTRY_GROUPS = [
  { id: 'bati-afrika',   label: 'Batı Afrika',         codes: ['NG','GH','SN','CI','CM','ML','BF','GN','BJ'] },
  { id: 'kuzey-afrika',  label: 'Kuzey Afrika',        codes: ['EG','MA','DZ','TN','LY'] },
  { id: 'orta-dogu',     label: 'Orta Doğu',           codes: ['SA','AE','QA','KW','IQ','JO'] },
  { id: 'fransizca',     label: 'Fransızca Konuşan',   codes: ['FR','SN','CI','CM','DZ','MA','TN','BE'] },
  { id: 'turk-dunyasi',  label: 'Türk Dünyası',        codes: ['TR','AZ','KZ','UZ','TM','KG'] },
  { id: 'eski-sovyet',   label: 'Rusça Konuşan',       codes: ['RU','UA','KZ','UZ','AZ'] },
  { id: 'bati-avrupa',   label: 'Batı Avrupa',         codes: ['DE','GB','FR','NL','BE','IT','ES'] },
];

// Ülke çoklu seçici bileşeni
function CountryPicker({ selected, onChange }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [savedGroups, setSavedGroups] = useState([]);
  const [saveLabel, setSaveLabel] = useState('');
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    fetch('/api/country-groups').then((r) => r.json()).then((d) => { if (d.ok) setSavedGroups(d.groups || []); }).catch(() => {});
  }, []);

  const filtered = COUNTRY_LIST.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(code) {
    const next = selected.includes(code) ? selected.filter((x) => x !== code) : [...selected, code];
    onChange(next);
  }

  function applyGroup(codes) {
    const next = [...new Set([...selected, ...codes])];
    onChange(next);
  }

  async function saveGroup() {
    if (!saveLabel.trim() || selected.length === 0) return;
    const res = await fetch('/api/country-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: saveLabel.trim(), codes: selected }) });
    const d = await res.json();
    if (d.ok) { setSavedGroups((g) => [...g, d.group]); setSaveLabel(''); setShowSave(false); }
  }

  async function deleteGroup(id) {
    await fetch('/api/country-groups', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setSavedGroups((g) => g.filter((x) => x.id !== id));
  }

  const allGroups = [...COUNTRY_GROUPS, ...savedGroups];

  return (
    <div className="space-y-2">
      {/* Hazır Gruplar */}
      <div className="flex flex-wrap gap-1.5">
        {allGroups.map((g) => (
          <span key={g.id} className="flex items-center gap-1">
            <button className="pill pill-muted text-xs hover:bg-navy/10" onClick={() => applyGroup(g.codes)}>
              + {g.label} ({g.codes.length})
            </button>
            {g.id.startsWith('custom-') && (
              <button className="text-[10px] text-slate-500 hover:text-red" onClick={() => deleteGroup(g.id)}>✕</button>
            )}
          </span>
        ))}
        <button className="pill pill-muted text-xs hover:bg-amber/10" onClick={() => setShowSave((s) => !s)}>
          💾 Grubumu Kaydet
        </button>
      </div>

      {showSave && selected.length > 0 && (
        <div className="flex gap-2 items-center">
          <input className="input text-sm flex-1" placeholder="Grup adı (örn: Müşterilerim)" value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)} />
          <button className="btn btn-primary text-xs" onClick={saveGroup}>Kaydet ({selected.length})</button>
          <button className="btn btn-ghost text-xs" onClick={() => setShowSave(false)}>İptal</button>
        </div>
      )}

      {/* Seçilmiş ülkeler */}
      <div className="flex flex-wrap gap-1 min-h-[28px]">
        {selected.map((code) => {
          const c = COUNTRY_LIST.find((x) => x.code === code);
          return (
            <span key={code} className="pill pill-ok text-xs flex items-center gap-1">
              {c?.flag} {c?.name || code}
              <button className="ml-0.5 text-[10px] hover:text-red" onClick={() => toggle(code)}>✕</button>
            </span>
          );
        })}
        {selected.length === 0 && <span className="text-xs text-slate-500">Ülke seçin…</span>}
      </div>

      {/* Arama + dropdown */}
      <div className="relative">
        <input
          className="input text-sm pr-8"
          placeholder="Ülke ara (Türkiye, Almanya…)"
          value={search}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        />
        <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs"
          onClick={() => setOpen((o) => !o)}>{open ? '▲' : '▼'}</button>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-line rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 && <p className="text-xs text-slate-500 p-3">Sonuç yok.</p>}
          {filtered.map((c) => (
            <button key={c.code}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-navy/5 flex items-center gap-2 ${selected.includes(c.code) ? 'bg-navy/5 font-medium' : ''}`}
              onClick={() => { toggle(c.code); setSearch(''); }}>
              <span>{c.flag}</span>
              <span>{c.name}</span>
              {selected.includes(c.code) && <span className="ml-auto text-ok text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ ok, children }) {
  return <span className={`pill ${ok ? 'pill-ok' : 'pill-muted'}`}>{ok ? '✓' : '○'} {children}</span>;
}

export default function KampanyalarClient({ products }) {
  const [slug, setSlug] = useState(products[0]?.slug || '');
  const selected = products.find((p) => p.slug === slug);

  return (
    <div className="space-y-6 min-w-0">
      <div className="card p-4 sm:p-5 min-w-0">
        <label className="label">Ürün</label>
        <select className="select max-w-full" value={slug} onChange={(e) => setSlug(e.target.value)}>
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
          <ReportSection key={`r-${slug}`} slug={slug} productName={selected.name} />
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
    <section className="card p-4 sm:p-5 space-y-3 min-w-0">
      <h2 className="font-head font-bold">Hedefleme</h2>
      {!hasConfig && <p className="text-sm text-amber break-words">⚠ Bu ürünün creative config'i yok; hedefleme kaydedilemez.</p>}
      <p className="text-xs text-slate-500 break-words">Her satır bir reklam grubu (ad set). Dil, mesaj dilini; ülkeler gösterim ülkesini; hedef kitle ise içerik açısını belirler.</p>
      <div className="space-y-4">
        {adsets.map((a, i) => (
          <div key={i} className="border border-line rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Reklam Grubu {i + 1}</span>
              <button className="btn btn-ghost text-xs" onClick={() => delRow(i)}>✕ Sil</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label mb-1">Mesaj Dili</label>
                <select className="select" value={a.lang} onChange={(e) => update(i, 'lang', e.target.value)}>
                  {LANGS.map((x) => <option key={x.id} value={x.id}>{x.l}</option>)}
                </select>
              </div>
              <div>
                <label className="label mb-1">Hedef Müşteri <span className="text-slate-500 font-normal text-[10px]">(birden fazla seçilebilir)</span></label>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  {CONCEPT_OPTIONS.map((c) => {
                    const current = Array.isArray(a.concepts) ? a.concepts : [a.concept || 'a'];
                    const checked = current.includes(c.id);
                    return (
                      <label key={c.id} className={`flex items-start gap-1.5 p-1.5 rounded-lg cursor-pointer text-xs border transition min-w-0 ${checked ? 'border-red/30 bg-red/5' : 'border-transparent hover:bg-slate-50'}`}>
                        <input type="checkbox" className="mt-0.5 accent-red shrink-0" checked={checked}
                          onChange={() => {
                            const next = checked ? current.filter((x) => x !== c.id) : [...current, c.id];
                            update(i, 'concepts', next.length > 0 ? next : ['a']);
                            update(i, 'concept', next[0] || 'a');
                          }} />
                        <span className="min-w-0 break-words"><b>{c.label}</b><br/><span className="text-slate-500">{c.desc}</span></span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <label className="label mb-1">Hedef Ülkeler</label>
              <CountryPicker
                selected={Array.isArray(a.countries) ? a.countries : String(a.countries || '').split(',').map((x) => x.trim()).filter(Boolean)}
                onChange={(codes) => update(i, 'countries', codes)} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-ghost text-sm" onClick={addRow} disabled={!hasConfig}>+ Reklam Grubu Ekle</button>
        <button className="btn btn-primary text-sm" onClick={save} disabled={busy || !hasConfig}>{busy ? 'Kaydediliyor…' : 'Hedeflemeyi Kaydet'}</button>
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
                <div className="text-slate-500 mt-1">CTA: {b.cta}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Metin düzenleme şu an config dosyasında; sonraki sürümde buradan editlenecek.</p>
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
  // hazır creative ekle (HF ID / dosya / URL)
  const [addSource, setAddSource] = useState('hf-id');
  const [addValue, setAddValue] = useState('');
  const [addFile, setAddFile] = useState(null);
  const [addBrand, setAddBrand] = useState(true);
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState(null);
  const [onayModal, onayIste] = useOnayModal(); // marka-uyumlu para-onay

  const load = useCallback(async () => {
    const res = await fetch(`/api/creative?slug=${slug}`);
    const d = await res.json();
    setHasConfig(d.hasConfig);
    setCreatives(d.creatives || []);
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  async function regenerate() {
    setBusy(true); setErr(null); setLog(null);
    try {
      const send = (extra) => fetch('/api/creative', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...extra }),
      });
      let res = await send();
      if (res.status === 402) {
        let g = {}; try { g = await res.json(); } catch { /* */ }
        if (g.requiresConfirm) {
          const ok = await onayIste({
            baslik: 'Creative yeniden üretimi',
            mesaj: 'Creative yeniden üretimi Higgsfield/fal kredisi yakabilir. Hazır görselin varsa '
              + '"Hazır creative ekle" daha ucuz. Yine de yeniden üretilsin mi?',
            kredi: g.credits ?? '?',
            onayLabel: 'Yeniden üret (kredi)',
            ipucu: 'Kredi yakmayan yol: "Hazır creative ekle" ile mevcut görseli getir.',
          });
          if (!ok) { setBusy(false); return; }
          res = await send({ confirmSpend: true });
        }
      }
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setCreatives(d.creatives || []);
      setLog(d.log);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function addCreative() {
    setAddBusy(true); setErr(null); setAddMsg(null);
    try {
      let d;
      if (addSource === 'dosya') {
        if (!addFile) { setAddMsg('Önce bir dosya seçin.'); return; }
        const fd = new FormData();
        fd.append('slug', slug); fd.append('file', addFile); fd.append('brand', String(addBrand));
        const res = await fetch('/api/creative/import', { method: 'POST', body: fd });
        d = await res.json();
      } else {
        if (!addValue.trim()) { setAddMsg(addSource === 'hf-id' ? 'Higgsfield iş ID girin.' : 'Geçerli bir URL girin.'); return; }
        const res = await fetch('/api/creative/import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, source: addSource, value: addValue.trim(), brand: addBrand }),
        });
        d = await res.json();
      }
      if (!d.ok) throw new Error(d.error);
      setCreatives(d.creatives || []);
      setAddValue(''); setAddFile(null);
      setAddMsg(addBrand ? 'Eklendi ✓ — marka katmanı uygulandı.' : 'Eklendi ✓ — ham görsel creative olarak eklendi.');
    } catch (e) { setErr('Ekleme hatası: ' + e.message); }
    finally { setAddBusy(false); }
  }

  return (
    <section className="card p-4 sm:p-5 space-y-3 min-w-0">
      {onayModal}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-head font-bold">Creative <span className="text-xs font-normal text-slate-500">(reklam görseli)</span> ({creatives.length})</h2>
        <button className="btn btn-ghost text-sm" onClick={regenerate} disabled={busy || !hasConfig}>{busy ? 'Üretiliyor…' : '↻ Yeniden üret (kredi)'}</button>
      </div>
      {!hasConfig && <p className="text-sm text-amber">⚠ Creative config yok; üretilemez. (HD foto + config gerekir.)</p>}

      {/* Hazır creative ekle — kredi yakmayan ana yol */}
      {hasConfig && (
        <div className="border border-ok/30 bg-ok/5 rounded-xl p-3">
          <div className="text-sm font-semibold mb-1">✅ Hazır creative ekle <span className="text-xs font-normal text-slate-500">(kredi yakmaz)</span></div>
          <p className="text-[11px] text-slate-500 mb-2">
            Higgsfield'de ürettiğin (veya hazır) görseli getir. <strong>Markala</strong> açık → marka navy şablonu + logo render edilir; kapalı → ham görsel doğrudan eklenir.
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {[['hf-id', '🎯 HF ID'], ['dosya', '📁 Dosya'], ['url', '🔗 URL']].map(([id, label]) => (
              <button key={id} onClick={() => { setAddSource(id); setAddMsg(null); }} className={`pill text-xs ${addSource === id ? 'pill-active' : 'pill-muted'}`}>{label}</button>
            ))}
            <button onClick={() => setAddBrand((b) => !b)} className={`pill text-xs ${addBrand ? 'pill-active' : 'pill-muted'}`}>{addBrand ? '🏷️ Markala: açık' : '🏷️ Markala: kapalı'}</button>
          </div>
          {addSource === 'dosya'
            ? <input type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => setAddFile(e.target.files?.[0] || null)} />
            : <input className="input text-sm w-full" placeholder={addSource === 'hf-id' ? "Higgsfield iş ID'si" : 'https://… .png / .jpg / .webp'} value={addValue} onChange={(e) => setAddValue(e.target.value)} />}
          <button className="btn btn-primary text-sm mt-2" onClick={addCreative} disabled={addBusy}>{addBusy ? '⏳ Ekleniyor…' : '⬇ Creative Ekle'}</button>
          {addMsg && <p className="text-xs text-ok mt-1">{addMsg}</p>}
        </div>
      )}

      {err && <div className="text-red text-sm">⚠ {err}</div>}
      {creatives.length === 0 && hasConfig && <p className="text-sm text-slate-500">Henüz creative yok — “Hazır creative ekle” veya “Yeniden üret”.</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {creatives.map((c) => (
          <a key={c.rel} href={`/api/creative-image/${c.rel}`} target="_blank" rel="noreferrer" className="block group">
            <img src={`/api/creative-image/${c.rel}`} alt={c.file} loading="lazy"
              className="w-full rounded-lg border border-line object-cover aspect-[4/5] group-hover:opacity-90" />
            <div className="text-[10px] text-slate-500 mt-1 truncate">
              {c.lang !== '—' && <span className="uppercase">{c.lang}</span>} {c.variant === 'b' ? '· B' : ''} · {c.size}
            </div>
          </a>
        ))}
      </div>
      {log && <pre className="text-[10px] text-slate-500 bg-slate-50 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">{log}</pre>}
    </section>
  );
}

/* ---------------- Kurulum (plan + PAUSED kur) ---------------- */
function SetupSection({ product }) {
  const slug = product.slug;
  const [onayModal, onayIste] = useOnayModal();
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
    const ok = await onayIste({
      baslik: 'Kampanyayı Meta\'ya kur (DURAKLATILMIŞ)',
      mesaj: `CANLI reklam hesabında DURAKLATILMIŞ (PAUSED) kampanya kurulacak — HARCAMA YOK. `
        + `Yayını sen Ads Manager'dan başlatana kadar hiçbir bütçe harcanmaz.\n\n`
        + `Ürün: ${product.name}\nDiller: ${langs.join(', ')}\nBütçe: $${daily}/gün/reklam grubu`,
      onayLabel: 'Duraklatılmış kur (harcama yok)',
      ipucu: 'Kampanya PAUSED durumda oluşturulur; onayın olmadan yayına geçmez.',
    });
    if (!ok) return;
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
    <section className="card p-4 sm:p-5 space-y-4 min-w-0">
      {onayModal}
      <h2 className="font-head font-bold">Kurulum</h2>
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
          <label className="label">Günlük Reklam Bütçesi</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">$</span>
            <input className="input num w-24" type="number" value={daily} onChange={(e) => setDaily(e.target.value)} />
            <span className="text-sm text-slate-500">USD / gün / reklam grubu</span>
          </div>
        </div>
      </div>
      <button className="btn btn-primary" onClick={buildPlan} disabled={busy || langs.length === 0}>
        {busy ? 'Çalışıyor…' : '📋 Kampanyayı Önizle'}
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
              <div className="flex items-center justify-between mb-1"><b className="text-xs">{a.name}</b><span className="text-[11px] text-slate-500">{a.geo.join(', ')} · {a.daily_budget_usd}/gün</span></div>
              {a.creative.primary_text && <p className="text-xs text-slate-600 whitespace-pre-line">{a.creative.primary_text}</p>}
              <div className="flex flex-wrap gap-3 mt-1 text-[11px]">
                {a.creative.video_url && <a href={a.creative.video_url} target="_blank" rel="noreferrer" className="text-red hover:underline">🎬 video</a>}
                <a href={a.creative.whatsapp_link} target="_blank" rel="noreferrer" className="text-ok hover:underline">📱 WhatsApp</a>
              </div>
            </div>
          ))}
          <button className="btn btn-primary text-sm" onClick={createReal} disabled={busy}>
            {busy ? 'Kuruluyor…' : '🚀 Kampanyayı Meta\'ya Kur (Duraklatılmış — harcama yok)'}
          </button>
          <p className="text-[11px] text-slate-500 break-words">Meta hesabına DURAKLATILMIŞ olarak yazar. Yayını sen Ads Manager'dan başlatırsın.</p>
        </div>
      )}

      {created && (
        <div className="border-t border-line pt-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="pill pill-ok">KURULDU · PAUSED</span>
            <span className="text-xs text-slate-600">ID: <span className="num">{created.campaign_id}</span></span>
          </div>
          <ul className="text-[11px] text-slate-500 mt-1 space-y-1">
            {created.ad_sets.map((a, i) => <li key={i}>{a.lang.toUpperCase()} · {a.geo.join(',')} · adset {a.adset_id} · ad {a.ad_id}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ---------------- 📊 Rapor ---------------- */
function ReportSection({ slug, productName }) {
  const [preset, setPreset] = useState('last_7d');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [onlyThis, setOnlyThis] = useState(true);

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

  // Bu ürünün reklamlarını ad adından eşleştir (slug veya ürün adı tokenları)
  function matchesProduct(adName) {
    if (!adName) return false;
    const hay = adName.toLowerCase();
    if (slug && hay.includes(slug.toLowerCase())) return true;
    const tokens = (productName || '').toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    return tokens.some((t) => hay.includes(t));
  }

  const allRows = data?.summary || [];
  const rows = onlyThis ? allRows.filter((r) => matchesProduct(r.ad)) : allRows;

  return (
    <section className="card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-head font-bold">Performans Raporu</h2>
        <div className="flex items-center gap-2">
          <select className="select w-32" value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="last_7d">Son 7 gün</option>
            <option value="last_30d">Son 30 gün</option>
            <option value="maximum">Tüm zaman</option>
          </select>
          <button className="btn btn-primary text-sm" onClick={run} disabled={busy}>{busy ? 'Çekiliyor…' : 'Rapor çek'}</button>
        </div>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-500">READ-ONLY Meta Insights. PAUSED kampanyada veri boş gelir (normal); yayında dolar.</p>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
          <input type="checkbox" className="accent-red" checked={onlyThis} onChange={(e) => setOnlyThis(e.target.checked)} />
          Sadece bu ürün ({productName})
        </label>
      </div>
      {err && <div className="text-red text-sm">⚠ {err}</div>}
      {data && allRows.length === 0 && <p className="text-sm text-slate-500">Veri yok — kampanyalar henüz yayında değil. ({data.total_rows} arşiv satırı)</p>}
      {data && allRows.length > 0 && rows.length === 0 && (
        <p className="text-sm text-slate-500">Bu ürün için yayında reklam verisi yok. <button className="underline" onClick={() => setOnlyThis(false)}>Tümünü göster</button></p>
      )}
      {rows.length > 0 && (
        <table className="w-full text-xs">
          <thead><tr className="text-slate-500 text-left border-b border-line">
            <th className="py-1">Reklam</th><th className="text-right">Harcama</th><th className="text-right">Gösterim</th><th className="text-right">Sohbet</th><th className="text-right">CPL</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
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
