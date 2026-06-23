'use client';

import { useState, useEffect, useRef } from 'react';
import PipelinePanel from './PipelinePanel';
import AssetLibrary from './AssetLibrary';

const LANG_LABEL = { tr: 'TR', en: 'EN', ar: 'AR', fr: 'FR', ru: 'RU' };

const TABS = [
  { id: 'brief',  label: '📋 Brief'  },
  { id: 'gorsel', label: '🖼️ Görsel' },
  { id: 'icerik', label: '✍️ İçerik' },
  { id: 'video',  label: '🎬 Video'  },
  { id: 'reklam', label: '📣 Reklam' },
];

const IMAGE_TEMPLATES = [
  { id: 'makine-vitrin',    label: 'Makine Vitrin',    emoji: '🏭', desc: 'Lifestyle ürün sahnesi', cost: '~$0.02' },
  { id: 'muhendis-anlatim', label: 'Mühendis Anlatım', emoji: '👷', desc: 'Mühendis + makine',      cost: '~$0.03' },
];

const ALL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸', apiMode: 'meta' },
  { id: 'linkedin',  label: 'LinkedIn',  icon: '💼', apiMode: 'icerik-ajani' },
  { id: 'x',        label: 'X',         icon: '𝕏',  apiMode: 'icerik-ajani' },
  { id: 'tiktok',   label: 'TikTok',    icon: '🎵', apiMode: 'assisted' },
  { id: 'youtube',  label: 'YouTube',   icon: '▶️', apiMode: 'assisted' },
  { id: 'facebook', label: 'Facebook',  icon: '📘', apiMode: 'meta' },
];

export default function UrunDetay({ product, initialContent }) {
  const m = product.marketing || {};
  const langs = m.languages?.length ? m.languages : ['tr', 'en'];

  const [tab, setTab] = useState('brief');
  const [content, setContent] = useState(initialContent || {});
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  // ── Brief ──
  const [brief, setBrief] = useState(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefMsg, setBriefMsg] = useState(null);

  // ── Görsel ──
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [activeTemplate, setActiveTemplate] = useState('makine-vitrin');
  const [gorselBusy, setGorselBusy] = useState(false);
  const [gorsel, setGorsel] = useState(null);

  // ── İçerik ──
  const [platforms, setPlatforms] = useState(['instagram']);
  const [lang, setLang] = useState(langs[0]);
  const [textBusy, setTextBusy] = useState(false);
  const [texts, setTexts] = useState({});
  const [calBusy, setCalBusy] = useState(false);
  const [calMsg, setCalMsg] = useState(null);

  // ── Video ──
  const [videoLang, setVideoLang] = useState(langs[0]);
  const [wantVoice, setWantVoice] = useState(true);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoElapsed, setVideoElapsed] = useState(0);
  const [videoResult, setVideoResult] = useState(null);
  const videoTimerRef = useRef(null);

  // ── Reklam copy ──
  const [copyBusy, setCopyBusy] = useState(false);
  const [draft, setDraft] = useState(null);
  const [activeVariant, setActiveVariant] = useState('A');
  const [activeLang, setActiveLang] = useState(langs[0]);
  const [saveBusy, setSaveBusy] = useState(false);

  // Yükle: ilk content'ten state
  useEffect(() => {
    if (content.gorsel) setGorsel(content.gorsel);
    if (content.metin?.texts) setTexts(content.metin.texts);
    if (content.video) setVideoResult(content.video);
  }, []); // eslint-disable-line

  useEffect(() => {
    setDraft(content.copy ? JSON.parse(JSON.stringify(content.copy)) : null);
  }, [content.copy]);

  useEffect(() => () => clearInterval(videoTimerRef.current), []);

  // Brief yükle
  useEffect(() => {
    fetch(`/api/brief?slug=${product.slug}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok && d.brief) setBrief(d.brief); })
      .catch(() => {});
  }, [product.slug]);

  // Mevcut yüklü görsel
  useEffect(() => {
    const url = `/products/${product.slug}/base.png`;
    const img = new Image();
    img.onload = () => setUploadedUrl(url + '?t=' + Date.now());
    img.onerror = () => {};
    img.src = url + '?t=' + Date.now();
  }, [product.slug]);

  const togglePlatform = (id) =>
    setPlatforms((ps) => (ps.includes(id) ? ps.filter((x) => x !== id) : [...ps, id]));

  // ── Brief kaydet ──
  async function saveBrief() {
    setBriefBusy(true); setBriefMsg(null);
    try {
      const res = await fetch('/api/brief', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.slug, ...brief }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setBrief(d.brief);
      setBriefMsg('Brief kaydedildi ✓');
    } catch (e) { setBriefMsg('⚠ ' + e.message); }
    finally { setBriefBusy(false); }
  }

  function updateHighlight(i, val) {
    setBrief((b) => { const h = [...(b?.highlights || [])]; h[i] = val; return { ...b, highlights: h }; });
  }
  function addHighlight() {
    setBrief((b) => ({ ...b, highlights: [...(b?.highlights || []), ''] }));
  }
  function removeHighlight(i) {
    setBrief((b) => ({ ...b, highlights: (b?.highlights || []).filter((_, j) => j !== i) }));
  }

  // ── Görsel upload ──
  async function handleUpload() {
    if (!uploadFile) return;
    setUploadBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('slug', product.slug);
      fd.append('file', uploadFile);
      const res = await fetch('/api/products/upload-image', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      const newUrl = d.localUrl + '?t=' + Date.now();
      setUploadedUrl(newUrl);
      setUploadFile(null);
      setMsg('Fotoğraf yüklendi ✓ — Görsel ve Video üretimi bu fotoğrafı kaynak olarak kullanacak.');
    } catch (e) { setError('Upload hatası: ' + e.message); }
    finally { setUploadBusy(false); }
  }

  // ── Görsel üret ──
  async function handleGenGorsel() {
    setGorselBusy(true); setError(null);
    try {
      const res = await fetch('/api/generate/gorsel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.slug, template: activeTemplate, lang: langs[0], platforms: ['instagram'], force: true }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setGorsel(d.gorsel);
      setContent((c) => ({ ...c, gorsel: d.gorsel }));
      setMsg(d.gorsel.imageSource === 'img2img' ? 'Görsel üretildi (makine fotoğrafından) ✓' : 'Görsel üretildi ✓');
    } catch (e) { setError('Görsel hatası: ' + e.message); }
    finally { setGorselBusy(false); }
  }

  // ── Metin üret ──
  async function handleGenText() {
    if (platforms.length === 0) { setError('En az bir platform seçin.'); return; }
    setTextBusy(true); setError(null);
    try {
      const res = await fetch('/api/generate/metin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.slug, lang, platforms, template: 'makine-vitrin' }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setTexts(d.texts);
      setContent((c) => ({ ...c, metin: { texts: d.texts, lang, platforms } }));
    } catch (e) { setError('Metin hatası: ' + e.message); }
    finally { setTextBusy(false); }
  }

  async function handleAddToCalendar() {
    const mediaUrl = gorsel?.localPath || gorsel?.url || videoResult?.localPath || videoResult?.url || '';
    if (!mediaUrl) { setCalMsg('Önce görsel veya video üretin.'); return; }
    setCalBusy(true); setCalMsg(null);
    const isVideo = Boolean(videoResult?.url);
    try {
      for (const platform of platforms) {
        const pt = texts[platform] || {};
        const fullCaption = pt.hashtags?.length ? `${pt.caption || ''}\n\n${pt.hashtags.join(' ')}` : (pt.caption || '');
        await fetch('/api/calendar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: product.slug, platform, lang, caption: fullCaption,
            videoUrl: isVideo ? mediaUrl : '', imageUrl: isVideo ? '' : mediaUrl }),
        });
      }
      setCalMsg(`${platforms.length} gönderi takvime eklendi → İçerik Takviminde onay gerekir.`);
    } catch (e) { setCalMsg('⚠ ' + e.message); }
    finally { setCalBusy(false); }
  }

  // ── Video üret ──
  function startVideoTimer() {
    setVideoElapsed(0); clearInterval(videoTimerRef.current);
    videoTimerRef.current = setInterval(() => setVideoElapsed((s) => s + 1), 1000);
  }

  async function handleGenVideo() {
    setVideoBusy(true); setError(null); startVideoTimer();
    try {
      const res = await fetch('/api/generate/video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.slug, lang: videoLang, voice: wantVoice, music: false, duration: 10, force: true }),
      });
      const d = await res.json();
      if (!d.ok) {
        if (d.action === 'upload_image') throw new Error('Kaynak görsel yok. Görsel sekmesinden fotoğraf yükleyin veya önce Görsel Üret çalıştırın.');
        throw new Error(d.error + (d.detail ? ` (${d.detail})` : ''));
      }
      setVideoResult(d.video);
      setContent((c) => ({ ...c, video: d.video }));
      setMsg('Video hazır ✓');
    } catch (e) { setError('Video hatası: ' + e.message); }
    finally { setVideoBusy(false); clearInterval(videoTimerRef.current); }
  }

  // ── Reklam copy ──
  const variant = draft?.variants?.find((v) => v.id === activeVariant) || draft?.variants?.[0];
  const langData = variant?.by_lang?.[activeLang];

  function editField(field, value) {
    setDraft((d) => {
      const copy = JSON.parse(JSON.stringify(d));
      const v = copy.variants.find((x) => x.id === variant?.id);
      if (v) v.by_lang[activeLang][field] = value;
      return copy;
    });
  }

  async function genCopy() {
    setCopyBusy(true); setError(null);
    try {
      const res = await fetch('/api/generate/copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.slug, languages: langs }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setContent((c) => ({ ...c, copy: d.copy }));
      setActiveVariant(d.copy.variants?.[0]?.id || 'A');
    } catch (e) { setError('Copy hatası: ' + e.message); }
    finally { setCopyBusy(false); }
  }

  async function saveCopy() {
    if (!draft) return;
    setSaveBusy(true);
    try {
      const res = await fetch('/api/content', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.slug, copy: { ...draft, at: new Date().toISOString() } }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setContent((c) => ({ ...c, copy: d.content.copy }));
      setMsg('Reklam metni kaydedildi ✓');
    } catch (e) { setError('Kaydet: ' + e.message); }
    finally { setSaveBusy(false); }
  }

  const gorselUrl = gorsel?.localPath || gorsel?.url;
  const videoUrl  = videoResult?.localPath || videoResult?.url;

  const voiceCharLabel = {
    tr: 'Roman — erkek, enerjik', en: 'Brooks — erkek, sıcak',
    ar: 'Gia — kadın, sıcak',    fr: 'Brooks', ru: 'Roman',
  };

  return (
    <div className="mt-3">
      {/* Başlık */}
      <div className="mb-5 flex items-start gap-4">
        {uploadedUrl && (
          <img src={uploadedUrl} alt="Ürün" className="w-14 h-14 rounded-xl object-cover border border-line shrink-0" />
        )}
        <div>
          <h1 className="font-head font-extrabold text-2xl md:text-3xl">{m.name_tr || product.name_en}</h1>
          <div className="text-slate-500 text-sm mt-1">{product.category}{product.specs?.capacity ? ` · ${product.specs.capacity}` : ''}</div>
        </div>
      </div>

      {error && (
        <div className="card p-3 border-red/40 text-red text-sm mb-4">
          ⚠ {error}
          <button className="ml-2 text-xs underline" onClick={() => setError(null)}>kapat</button>
        </div>
      )}
      {msg && (
        <div className="card p-3 text-ok text-sm mb-4">
          ✓ {msg}
          <button className="ml-2 text-xs underline" onClick={() => setMsg(null)}>kapat</button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-0 mb-6 border-b border-line overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={[
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              tab === t.id
                ? 'border-navy text-navy bg-navy/3'
                : 'border-transparent text-slate-500 hover:text-navy hover:bg-navy/3',
            ].join(' ')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ BRIEF ═══ */}
      {tab === 'brief' && (
        <section className="card p-5 space-y-5">
          <div>
            <h2 className="font-head font-bold text-lg mb-1">Ürün Brief</h2>
            <p className="text-sm text-slate-500">
              Bu bilgiler metin, video ve reklam üretiminde kullanılır.
              Doğru doldurun — sistem artık hayal etmez, sizi dinler.
            </p>
          </div>

          <div>
            <label className="label mb-2">Öne çıkan özellikler (en az 3 madde)</label>
            <div className="space-y-2">
              {(brief?.highlights || []).map((h, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input flex-1" value={h} onChange={(e) => updateHighlight(i, e.target.value)} placeholder={`Özellik ${i + 1}`} />
                  <button className="btn btn-ghost text-xs px-2" onClick={() => removeHighlight(i)}>✕</button>
                </div>
              ))}
              {(brief?.highlights || []).length === 0 && (
                <p className="text-sm text-slate-400">Henüz özellik eklenmedi. Brief AI tarafından otomatik doldurulabilir.</p>
              )}
              <button className="btn btn-ghost text-sm" onClick={addHighlight}>+ Özellik ekle</button>
            </div>
          </div>

          <div>
            <label className="label mb-1">Hedef müşteri profili</label>
            <input className="input" value={brief?.ideal_customer || ''}
              onChange={(e) => setBrief((b) => ({ ...b, ideal_customer: e.target.value }))}
              placeholder="Ör: Günlük 5.000+ paket üretmek isteyen gıda üreticisi" />
          </div>

          <div>
            <label className="label mb-1">Kesinlikle söylenmeyecekler <span className="font-normal text-slate-400">(virgülle ayır)</span></label>
            <input className="input"
              value={(brief?.dont_say || []).join(', ')}
              onChange={(e) => setBrief((b) => ({ ...b, dont_say: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))}
              placeholder="Ör: Avrupa teknolojisi, İthal parça" />
          </div>

          <div>
            <label className="label mb-1">Görsel üretim notu</label>
            <input className="input" value={brief?.image_notes || ''}
              onChange={(e) => setBrief((b) => ({ ...b, image_notes: e.target.value }))}
              placeholder="Ör: Sarı granüller, beyaz poşetler, sanayi ortamı" />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-line">
            <button className="btn btn-primary" onClick={saveBrief} disabled={briefBusy}>
              {briefBusy ? 'Kaydediliyor…' : '💾 Brief Kaydet'}
            </button>
            {!brief?.approved ? (
              <button className="btn btn-ghost text-sm"
                onClick={() => setBrief((b) => ({ ...b, approved: true }))}>
                ✓ Onayla
              </button>
            ) : (
              <span className="pill pill-ok text-xs">✓ Onaylı</span>
            )}
            {briefMsg && <span className="text-sm text-slate-500">{briefMsg}</span>}
          </div>
        </section>
      )}

      {/* ═══ GÖRSEL ═══ */}
      {tab === 'gorsel' && (
        <div className="space-y-5">
          {/* Upload */}
          <section className="card p-5">
            <h2 className="font-head font-bold mb-1">📷 Makine Fotoğrafı</h2>
            <p className="text-sm text-slate-500 mb-4">
              Yüklenen fotoğraf img2img kaynak olur — makine yapısı korunur, arka plan / ışık değişir.
            </p>

            {uploadedUrl && (
              <div className="mb-4">
                <img src={uploadedUrl} alt="Yüklü fotoğraf" className="w-40 h-40 object-cover rounded-xl border border-line" />
                <div className="text-xs text-ok mt-1">✓ Fotoğraf yüklü</div>
              </div>
            )}

            <div className="border-2 border-dashed border-line rounded-xl p-6 text-center cursor-pointer hover:border-navy/40 transition-colors"
              onClick={() => document.getElementById('file-upload').click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); setUploadFile(e.dataTransfer.files?.[0] || null); }}>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" id="file-upload"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              <div className="text-2xl mb-2">📁</div>
              <div className="text-sm text-slate-600">{uploadFile ? uploadFile.name : 'JPG, PNG veya WEBP seçin'}</div>
              <div className="text-xs text-slate-400 mt-1">tıklayın veya buraya sürükleyin</div>
            </div>

            {uploadFile && (
              <button className="btn btn-primary mt-3" onClick={handleUpload} disabled={uploadBusy}>
                {uploadBusy ? 'Yükleniyor…' : '⬆ Yükle'}
              </button>
            )}
          </section>

          {/* AI Görsel */}
          <section className="card p-5">
            <h2 className="font-head font-bold mb-3">🎨 AI Görsel Üret</h2>
            {uploadedUrl && (
              <div className="text-xs text-ok mb-3">✓ Fotoğraf yüklü — img2img modunda üretilecek</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {IMAGE_TEMPLATES.map((t) => {
                const active = activeTemplate === t.id;
                return (
                  <button key={t.id} onClick={() => setActiveTemplate(t.id)}
                    className={[
                      'rounded-xl border p-4 text-left transition-all',
                      active ? 'border-navy bg-navy/5 ring-2 ring-navy/40' : 'border-line hover:border-navy/30',
                    ].join(' ')}>
                    <div className="text-2xl mb-1">{t.emoji}</div>
                    <div className="font-semibold text-sm">{t.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{t.desc} · {t.cost}</div>
                  </button>
                );
              })}
            </div>

            <button className="btn btn-primary" onClick={handleGenGorsel} disabled={gorselBusy}>
              {gorselBusy ? '⏳ Üretiliyor…' : gorselUrl ? '↻ Yeniden üret' : '⚡ Görsel Üret'}
            </button>

            {gorselUrl && (
              <div className="mt-4">
                <img src={gorselUrl} alt="Üretilen görsel" className="w-full max-w-sm rounded-xl border border-line" />
                <div className="text-xs text-slate-400 mt-1">
                  {gorsel?.imageSource === 'img2img' ? '✓ img2img (makine korundu)' : 'text2img'}
                  {gorsel?.localPath ? ' · yerel kopya' : ' · CDN'}
                  {gorsel?.provider ? ` · ${gorsel.provider}` : ''}
                </div>
                <a href={gorselUrl} download className="btn btn-ghost text-sm mt-2 inline-block">⬇ İndir</a>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ═══ İÇERİK ═══ */}
      {tab === 'icerik' && (
        <section className="card p-5 space-y-5">
          <h2 className="font-head font-bold text-lg">✍️ Sosyal Medya İçeriği</h2>

          <div>
            <label className="label mb-2">Platform</label>
            <div className="flex flex-wrap gap-2">
              {ALL_PLATFORMS.map((pl) => (
                <button key={pl.id} onClick={() => togglePlatform(pl.id)}
                  className={`pill ${platforms.includes(pl.id) ? 'pill-active' : 'pill-muted'}`}>
                  {pl.icon} {pl.label}
                  {pl.apiMode === 'assisted' && <span className="text-[10px] ml-1 opacity-60">(manuel)</span>}
                </button>
              ))}
            </div>
            {platforms.length === 0 && <p className="text-xs text-red mt-1">En az bir platform seçin.</p>}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label mb-1">Dil</label>
              <div className="flex gap-1.5">
                {langs.map((l) => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`pill ${l === lang ? 'pill-active' : 'pill-muted'}`}>
                    {LANG_LABEL[l] || l}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleGenText} disabled={textBusy || platforms.length === 0}>
              {textBusy ? '⏳ Yazılıyor…' : Object.keys(texts).length > 0 ? '↻ Yeniden üret' : '⚡ İçerik Üret'}
            </button>
          </div>

          {Object.keys(texts).length > 0 && (
            <div className="space-y-4">
              {platforms.map((platform) => {
                const pt = texts[platform];
                if (!pt) return null;
                const plInfo = ALL_PLATFORMS.find((p) => p.id === platform);
                return (
                  <div key={platform} className="border border-line rounded-xl p-4">
                    <div className="font-semibold text-sm mb-2">{plInfo?.icon} {plInfo?.label}</div>
                    {pt.error ? (
                      <p className="text-xs text-red">{pt.error}</p>
                    ) : (
                      <>
                        <textarea className="textarea text-sm" rows={4} defaultValue={pt.caption} />
                        {pt.hashtags?.length > 0 && (
                          <div className="mt-2 text-[11px] text-slate-500 leading-relaxed">{pt.hashtags.join(' ')}</div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {Object.keys(texts).length > 0 && (
            <div className="pt-4 border-t border-line flex items-center gap-3">
              <button className="btn btn-primary" onClick={handleAddToCalendar} disabled={calBusy}>
                {calBusy ? 'Ekleniyor…' : '📅 Takvime Ekle (onay gerekir)'}
              </button>
              {calMsg && <span className="text-sm text-slate-500">{calMsg}</span>}
            </div>
          )}
        </section>
      )}

      {/* ═══ VİDEO ═══ */}
      {tab === 'video' && (
        <section className="card p-5 space-y-5">
          <h2 className="font-head font-bold text-lg">🎬 Video Üret</h2>
          <p className="text-sm text-slate-500">9:16 tanıtım videosu — makine sahnesi, seslendirme ve marka kartları ile.</p>

          {!uploadedUrl && !gorselUrl && (
            <div className="card p-3 border-amber-400/40 text-amber-700 text-sm">
              ⚠ Video için kaynak görsel gerekli.{' '}
              <button className="underline" onClick={() => setTab('gorsel')}>Görsel sekmesine git →</button>
            </div>
          )}

          <div className="flex flex-wrap gap-5 items-start">
            <div>
              <label className="label mb-1">Dil</label>
              <div className="flex gap-1.5">
                {langs.map((l) => (
                  <button key={l} onClick={() => setVideoLang(l)}
                    className={`pill ${l === videoLang ? 'pill-active' : 'pill-muted'}`}>
                    {LANG_LABEL[l] || l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label mb-1">Seslendirme</label>
              <button onClick={() => setWantVoice((v) => !v)}
                className={`pill ${wantVoice ? 'pill-active' : 'pill-muted'}`}>
                {wantVoice ? '🎙️ Açık' : '🔇 Kapalı'}
              </button>
              {wantVoice && (
                <div className="text-[11px] text-slate-400 mt-1">
                  Higgsfield TTS · {voiceCharLabel[videoLang] || 'Roman'}
                </div>
              )}
            </div>
          </div>

          <button className="btn btn-primary text-base px-6 py-3" onClick={handleGenVideo} disabled={videoBusy}>
            {videoBusy
              ? `⏳ Üretiliyor… ${videoElapsed}s (≈3-5 dk)`
              : videoUrl ? '↻ Yeniden üret' : '🎬 Video Üret'}
          </button>

          {videoUrl && (
            <div>
              <video src={videoUrl} controls className="w-full max-w-xs rounded-xl border border-line bg-black"
                style={{ aspectRatio: '9/16' }} />
              <div className="flex gap-2 mt-2 items-center">
                <a href={videoUrl} download className="btn btn-ghost text-sm">⬇ İndir</a>
                {videoResult?.localPath && <span className="text-xs text-ok">✓ yerel kopya</span>}
                {videoResult?.voice && <span className="text-xs text-slate-400">🎙️ ses var</span>}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ═══ REKLAM ═══ */}
      {tab === 'reklam' && (
        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-head font-bold text-lg">📣 Reklam Kopyası</h2>
              <p className="text-xs text-slate-400">4 varyant (A-D), fiyatsız, özellik odaklı — düzenlenebilir</p>
            </div>
            <button className="btn btn-primary text-sm" onClick={genCopy} disabled={copyBusy}>
              {copyBusy ? 'Üretiliyor…' : draft ? '↻ Yeniden üret' : '✍ Üret'}
            </button>
          </div>

          {!draft && (
            <p className="text-slate-500 text-sm">
              Brief onaylıysa özellikler otomatik dahil edilir. Yoksa ürün bilgisinden çıkarır.
            </p>
          )}

          {draft?.highlights?.length > 0 && (
            <div>
              <div className="label mb-1">Özellikler (brieften)</div>
              <div className="flex flex-wrap gap-1.5">
                {draft.highlights.map((h, i) => <span key={i} className="pill pill-ok text-xs">{h}</span>)}
              </div>
            </div>
          )}

          {draft && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {draft.variants.map((v) => (
                  <button key={v.id} onClick={() => setActiveVariant(v.id)}
                    className={`pill ${v.id === activeVariant ? 'pill-active' : 'pill-muted'}`}
                    title={v.angle}>
                    {v.id} · {v.angle}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                {(draft.languages || langs).map((l) => (
                  <button key={l} onClick={() => setActiveLang(l)}
                    className={`pill ${l === activeLang ? 'pill-active' : 'pill-muted'}`}>
                    {LANG_LABEL[l] || l}
                  </button>
                ))}
              </div>
              {langData ? (
                <div className="space-y-3">
                  <div>
                    <label className="label">Headline</label>
                    <input className="input" value={langData.headline || ''} onChange={(e) => editField('headline', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Primary</label>
                    <textarea className="textarea" rows={3} value={langData.primary || ''} onChange={(e) => editField('primary', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <input className="input" value={langData.description || ''} onChange={(e) => editField('description', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">CTA</label>
                    <input className="input" value={langData.cta || ''} onChange={(e) => editField('cta', e.target.value)} />
                  </div>
                  <button className="btn btn-ghost text-sm" onClick={saveCopy} disabled={saveBusy}>
                    {saveBusy ? 'Kaydediliyor…' : '💾 Kaydet'}
                  </button>
                </div>
              ) : (
                <p className="text-slate-500 text-sm">Bu dil için veri yok.</p>
              )}
            </>
          )}
        </section>
      )}

      {/* Varlık Kütüphanesi — her sekmede erişilebilir */}
      <AssetLibrary slug={product.slug} />

      {/* Pipeline — daraltılmış gelişmiş bölüm */}
      <details className="mt-4">
        <summary className="cursor-pointer card p-3 text-sm text-slate-500 select-none">
          🔧 Gelişmiş: Aşamalı Üretim Hattı (Pipeline)
        </summary>
        <div className="mt-2">
          <PipelinePanel slug={product.slug} languages={langs} />
        </div>
      </details>
    </div>
  );
}
