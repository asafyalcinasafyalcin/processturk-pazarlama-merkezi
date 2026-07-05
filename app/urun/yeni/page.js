'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const STEPS = ['Temel Bilgiler', 'Teknik Özellikler', 'Reklam Bilgisi', 'Önizleme'];

const COUNTRIES = ['Cezayir', 'Mısır', 'Nijerya', 'Togo', 'Azerbaycan', 'Türkmenistan', 'Suudi Arabistan', 'BAE', 'Türkiye'];
const LANGS = [
  { id: 'tr', label: 'Türkçe' }, { id: 'en', label: 'English' },
  { id: 'ar', label: 'العربية' }, { id: 'fr', label: 'Français' }, { id: 'ru', label: 'Русский' },
];

const empty = {
  name_tr: '', name_en: '', category: '', code: '', price_usd: '', hd: false, notes: '',
  specs: { filled_products: '', filling_range: '', capacity: '', size: '', power: '', voltage: '' },
  video: '', source_image: '',
  audience: '', promise: '', hero_number: '', countries: [], languages: ['tr', 'en'],
};

export default function YeniUrunPage() {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // PDF / metin import state
  const [importMode, setImportMode] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState(null);

  async function handleImport() {
    if (!importText.trim() && !importFile) return;
    setImportBusy(true); setImportError(null);
    try {
      const fd = new FormData();
      if (importText.trim()) fd.append('text', importText.trim());
      if (importFile) fd.append('file', importFile);
      const res = await fetch('/api/products/import-pdf', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      const p = d.product;
      setForm((f) => ({
        ...f,
        name_tr: p.name_tr || f.name_tr,
        name_en: p.name_en || f.name_en,
        category: p.category || f.category,
        notes: p.notes || f.notes,
        specs: {
          filled_products: p.specs?.filled_products || f.specs.filled_products,
          filling_range: p.specs?.filling_range || f.specs.filling_range,
          capacity: p.specs?.capacity || f.specs.capacity,
          size: p.specs?.size || f.specs.size,
          power: p.specs?.power || f.specs.power,
          voltage: p.specs?.voltage || f.specs.voltage,
        },
        audience: p.audience || f.audience,
        promise: p.promise || f.promise,
        hero_number: p.hero_number || f.hero_number,
      }));
      setStarted(true);
    } catch (e) { setImportError(e.message); }
    finally { setImportBusy(false); }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setSpec = (k, v) => setForm((f) => ({ ...f, specs: { ...f.specs, [k]: v } }));
  const toggle = (k, v) => setForm((f) => {
    const arr = f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v];
    return { ...f, [k]: arr };
  });

  const canNext = () => {
    if (step === 0) return (form.name_tr || form.name_en).trim().length > 0;
    return true;
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price_usd: Number(form.price_usd) || 0 }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Kayıt başarısız');
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="px-4 md:px-10 py-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-head font-extrabold text-2xl">Yeni Ürün Ekle</h1>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">← Vazgeç</Link>
      </div>

      {/* ── Başlangıç Ekranı ── */}
      {!started && (
        <div className="space-y-4">
          {!importMode ? (
            <div className="card p-6 space-y-4">
              <h2 className="font-head font-bold text-lg">Nasıl başlamak istersiniz?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  className="card p-4 flex flex-col items-center gap-2 hover:border-navy/50 hover:bg-navy/5 cursor-pointer border border-line transition text-left"
                  onClick={() => setImportMode(true)}
                >
                  <span className="text-3xl">📄</span>
                  <span className="font-semibold text-sm">PDF / Doküman Yükle</span>
                  <span className="text-xs text-slate-500 text-center">Katalog ya da teknik dokümanı yapıştır, AI doldurun</span>
                </button>
                <button
                  className="card p-4 flex flex-col items-center gap-2 hover:border-navy/50 hover:bg-navy/5 cursor-pointer border border-line transition text-left"
                  onClick={() => setStarted(true)}
                >
                  <span className="text-3xl">📝</span>
                  <span className="font-semibold text-sm">Manuel Doldur</span>
                  <span className="text-xs text-slate-500 text-center">Adım adım wizard ile kendin doldur</span>
                </button>
                <a
                  href="/templates/urun-sablonu.csv"
                  download
                  className="card p-4 flex flex-col items-center gap-2 hover:border-navy/50 hover:bg-navy/5 cursor-pointer border border-line transition text-left no-underline"
                >
                  <span className="text-3xl">📊</span>
                  <span className="font-semibold text-sm">Excel Şablonu İndir</span>
                  <span className="text-xs text-slate-500 text-center">CSV şablonunu doldur, daha sonra manuel gir</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-head font-bold text-lg">📄 PDF / Metin ile Otomatik Doldur</h2>
                <button className="text-sm text-slate-500 hover:text-slate-700" onClick={() => setImportMode(false)}>← Geri</button>
              </div>
              <textarea
                className="input w-full text-sm"
                rows={6}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Ürün teknik dokümanı, katalog metni veya müşteri notunu yapıştırın…"
              />
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span>veya PDF dosyası:</span>
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  className="text-sm"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                {importFile && <span className="text-xs text-slate-500">{importFile.name}</span>}
              </div>
              {importError && <p className="text-red text-sm">⚠ {importError}</p>}
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={importBusy || (!importText.trim() && !importFile)}
              >
                {importBusy ? '⏳ AI analiz ediyor…' : '⚡ AI ile Formu Doldur'}
              </button>
              <p className="text-xs text-slate-500">AI çıktısını wizard adımlarında düzenleyebilirsin.</p>
            </div>
          )}
        </div>
      )}

      {/* Adım göstergesi */}
      {started && (<>
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center gap-2 text-xs font-semibold ${i <= step ? 'text-navy' : 'text-slate-500'}`}>
              <span className={`h-7 w-7 rounded-full flex items-center justify-center border ${i < step ? 'bg-ok/15 border-ok text-ok' : i === step ? 'bg-red border-red text-white' : 'border-slate-300 text-slate-500'}`}>
                {i < step ? '✓' : i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? 'bg-ok/50' : 'bg-line'}`} />}
          </div>
        ))}
      </div>

      <div className="card p-6">
        {step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Ürün Adı (TR)</label>
              <input className="input" value={form.name_tr} onChange={(e) => set('name_tr', e.target.value)} placeholder="Granül Dolum Makinesi" />
            </div>
            <div>
              <label className="label">Ürün Adı (EN)</label>
              <input className="input" value={form.name_en} onChange={(e) => set('name_en', e.target.value)} placeholder="Granule Filling Machine" />
            </div>
            <div>
              <label className="label">Kategori</label>
              <input className="input" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Filling / Granule" />
            </div>
            <div>
              <label className="label">Ürün Kodu (opsiyonel)</label>
              <input className="input" value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="otomatik üretilir" />
            </div>
            <div>
              <label className="label">Fiyat (USD)</label>
              <input className="input num" type="number" value={form.price_usd} onChange={(e) => set('price_usd', e.target.value)} placeholder="1150" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.hd} onChange={(e) => set('hd', e.target.checked)} />
                HD görsel mevcut
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Kısa Açıklama</label>
              <textarea className="textarea" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Bir cümleyle ürün ne işe yarar?" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Doldurulan / İşlenen Ürünler</label>
              <input className="input" value={form.specs.filled_products} onChange={(e) => setSpec('filled_products', e.target.value)} placeholder="Çay, kahve, baharat, şeker…" />
            </div>
            <div><label className="label">Dolum Aralığı</label><input className="input" value={form.specs.filling_range} onChange={(e) => setSpec('filling_range', e.target.value)} placeholder="20 gr - 1200 gr" /></div>
            <div><label className="label">Kapasite</label><input className="input" value={form.specs.capacity} onChange={(e) => setSpec('capacity', e.target.value)} placeholder="600-1000 adet/saat" /></div>
            <div><label className="label">Ebat</label><input className="input" value={form.specs.size} onChange={(e) => setSpec('size', e.target.value)} placeholder="60 x 50 x 150 cm" /></div>
            <div><label className="label">Güç</label><input className="input" value={form.specs.power} onChange={(e) => setSpec('power', e.target.value)} placeholder="300 Watt" /></div>
            <div><label className="label">Voltaj</label><input className="input" value={form.specs.voltage} onChange={(e) => setSpec('voltage', e.target.value)} placeholder="230 V / 50 Hz" /></div>
            <div><label className="label">YouTube Video (opsiyonel)</label><input className="input" value={form.video} onChange={(e) => set('video', e.target.value)} placeholder="https://youtube.com/…" /></div>
            <div className="sm:col-span-2">
              <label className="label">Ürün Görseli Yolu (opsiyonel)</label>
              <input className="input" value={form.source_image} onChange={(e) => set('source_image', e.target.value)} placeholder="Processturk_Satis_Dolum_Makinaları/…/urun.png" />
              <p className="text-[11px] text-slate-500 mt-1">Faz 2'de görsel yükleme eklenecek; şimdilik mevcut bir dosya yolu girilebilir.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl bg-red/10 border border-red/30 p-3 text-xs text-slate-600">
              <b>5 saniye kuralı:</b> Reklam ilk 3 saniyede üç şeyi vermeli — <b>NE</b> satıyoruz, <b>KİME</b>, ve <b>TEK</b> rakam/fayda. Aşağıdaki bilgiler içerik üretimini besler.
            </div>
            <div>
              <label className="label">Hedef Kitle (KİME)</label>
              <input className="input" value={form.audience} onChange={(e) => set('audience', e.target.value)} placeholder="Baharat paketleyen küçük üreticiler" />
            </div>
            <div>
              <label className="label">Tek Cümle Vaat</label>
              <input className="input" value={form.promise} onChange={(e) => set('promise', e.target.value)} placeholder="Elle paketlemeyi bırak, saatte 1000 paket doldur." />
            </div>
            <div>
              <label className="label">Öne Çıkan Rakam (TEK fayda)</label>
              <input className="input" value={form.hero_number} onChange={(e) => set('hero_number', e.target.value)} placeholder="900$'dan başlar · kurulum dahil" />
            </div>
            <div>
              <label className="label">Hedef Ülkeler</label>
              <div className="flex flex-wrap gap-2">
                {COUNTRIES.map((c) => (
                  <button type="button" key={c} onClick={() => toggle('countries', c)}
                    className={`pill ${form.countries.includes(c) ? 'pill-ok' : 'pill-muted'}`}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Diller</label>
              <div className="flex flex-wrap gap-2">
                {LANGS.map((l) => (
                  <button type="button" key={l.id} onClick={() => toggle('languages', l.id)}
                    className={`pill ${form.languages.includes(l.id) ? 'pill-ok' : 'pill-muted'}`}>{l.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-head font-bold">Önizleme</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field k="Ad (TR)" v={form.name_tr} />
              <Field k="Ad (EN)" v={form.name_en} />
              <Field k="Kategori" v={form.category} />
              <Field k="Fiyat" v={form.price_usd ? `${Number(form.price_usd).toLocaleString('en-US')} USD` : '—'} />
              <Field k="Kapasite" v={form.specs.capacity} />
              <Field k="Hedef Kitle" v={form.audience} />
              <Field k="Vaat" v={form.promise} full />
              <Field k="Öne Çıkan Rakam" v={form.hero_number} full />
              <Field k="Ülkeler" v={form.countries.join(', ')} full />
              <Field k="Diller" v={form.languages.join(', ')} full />
            </div>
            <p className="text-[11px] text-slate-500">
              Kaydedince ürün <span className="font-mono">data/products.json</span>'a eklenir (tek kaynak).
            </p>
            {error && <div className="text-red text-sm">⚠ {error}</div>}
          </div>
        )}
      </div>

      {/* Navigasyon */}
      <div className="flex items-center justify-between mt-6">
        <button className="btn btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>← Geri</button>
        {step < STEPS.length - 1 ? (
          <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>İleri →</button>
        ) : (
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Kaydediliyor…' : '✓ Ürünü Kaydet'}</button>
        )}
      </div>
      </>)}
    </div>
  );
}

function Field({ k, v, full }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-[11px] text-slate-500">{k}</div>
      <div className="text-slate-700">{v || <span className="text-slate-600">—</span>}</div>
    </div>
  );
}
