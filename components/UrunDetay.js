'use client';

import { useState, useEffect, useRef } from 'react';
import PipelinePanel from './PipelinePanel';
import AssetLibrary from './AssetLibrary';

const LANG_LABEL = { tr: 'TR', en: 'EN', ar: 'AR', fr: 'FR', ru: 'RU' };

const TEMPLATES = [
  { id: 'makine-vitrin',    label: 'Makine Vitrin',    emoji: '🏭', desc: 'Lifestyle ürün sahnesi',  type: 'image', cost: '~$0.02' },
  { id: 'muhendis-anlatim', label: 'Mühendis Anlatım', emoji: '👷', desc: 'Mühendis + makine',       type: 'image', cost: '~$0.03' },
  { id: 'kisa-video',       label: 'Kısa Video',       emoji: '🎬', desc: '10 sn tanıtım videosu',   type: 'video', cost: '~$0.15' },
  { id: 'maskot-konsept',   label: 'Maskot',           emoji: '🦸', desc: 'Soul ID eğitimi gerekli', type: 'image', cost: '~$0.05', requiresSoulId: true },
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

  const [content, setContent] = useState(initialContent || {});
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  // Şablon + platform seçimi
  const [activeTemplate, setActiveTemplate] = useState('makine-vitrin');
  const [platforms, setPlatforms] = useState(['instagram']);
  const [lang, setLang] = useState(langs[0]);

  // Üretim state
  const [genStage, setGenStage] = useState('idle'); // idle | gen-image | gen-video | gen-text | ready
  const [gorsel, setGorsel] = useState(null);
  const [texts, setTexts] = useState({}); // { platform: { caption, hashtags } }
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  // Paylaşım modal
  const [publishPlatform, setPublishPlatform] = useState(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishResult, setPublishResult] = useState(null);

  // Takvim
  const [calBusy, setCalBusy] = useState(false);
  const [calMsg, setCalMsg] = useState(null);

  // Reklam metni (mevcut copy sistemi — sağ panel)
  const [copyBusy, setCopyBusy] = useState(false);
  const [draft, setDraft] = useState(null);
  const [activeVariant, setActiveVariant] = useState('A');
  const [activeLang, setActiveLang] = useState(langs[0]);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    setDraft(content.copy ? JSON.parse(JSON.stringify(content.copy)) : null);
  }, [content.copy]);

  useEffect(() => {
    if (content.gorsel) setGorsel(content.gorsel);
    if (content.metin?.texts) setTexts(content.metin.texts);
  }, [content.gorsel, content.metin]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const currentTemplate = TEMPLATES.find((t) => t.id === activeTemplate) || TEMPLATES[0];
  const togglePlatform = (id) =>
    setPlatforms((ps) => (ps.includes(id) ? ps.filter((x) => x !== id) : [...ps, id]));

  function startTimer() {
    setElapsed(0);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }
  function stopTimer() { clearInterval(timerRef.current); }

  async function handleGenerate() {
    if (platforms.length === 0) { setError('En az bir platform seçin.'); return; }
    setError(null); setMsg(null); setGorsel(null); setTexts({});
    startTimer();

    try {
      if (currentTemplate.type === 'video') {
        // Kısa video → mevcut video pipeline (10s, voice/music opsiyonel)
        setGenStage('gen-video');
        const res = await fetch('/api/generate/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: product.slug, lang, voice: false, music: false, duration: 10 }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error + (data.detail ? ` (${data.detail})` : ''));
        setContent((c) => ({ ...c, video: data.video, scriptPlan: data.plan }));
        setGorsel({ url: data.video.url, type: 'video' });
      } else {
        // Görsel şablonlar
        setGenStage('gen-image');
        const imgRes = await fetch('/api/generate/gorsel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: product.slug, template: activeTemplate, lang, platforms }),
        });
        const imgData = await imgRes.json();
        if (!imgData.ok) throw new Error(imgData.error);
        setGorsel(imgData.gorsel);
        setContent((c) => ({ ...c, gorsel: imgData.gorsel }));
      }

      // Metin üret (görsel ve video için)
      setGenStage('gen-text');
      const txtRes = await fetch('/api/generate/metin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.slug, lang, platforms, template: activeTemplate }),
      });
      const txtData = await txtRes.json();
      if (txtData.ok) {
        setTexts(txtData.texts);
        setContent((c) => ({ ...c, metin: { texts: txtData.texts, lang, platforms, template: activeTemplate } }));
      }

      setGenStage('ready');
      setMsg('Görsel + metin hazır. Paylaşmak için platform seçin.');
    } catch (e) {
      setError('Üretim hatası: ' + e.message);
      setGenStage('idle');
    } finally {
      stopTimer();
    }
  }

  async function handleQuickPublish(platform) {
    setPublishBusy(true); setPublishResult(null); setError(null);
    const currentTexts = texts[platform] || texts['instagram'] || {};
    const caption = currentTexts.caption || '';
    const hashtags = currentTexts.hashtags || [];
    const isVideo = gorsel?.type === 'video' || currentTemplate.type === 'video';
    const mediaUrl = gorsel?.url || content.video?.url || '';

    try {
      const res = await fetch('/api/quick-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          imageUrl: isVideo ? undefined : mediaUrl,
          videoUrl: isVideo ? mediaUrl : undefined,
          caption,
          hashtags,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setPublishResult({ method: data.method, platform, pkg: data.package });
    } catch (e) {
      setError('Paylaşım hatası: ' + e.message);
    } finally {
      setPublishBusy(false);
    }
  }

  async function handleAddToCalendar() {
    if (!gorsel && !content.video) { setCalMsg('Önce içerik üretin.'); return; }
    setCalBusy(true); setCalMsg(null);
    const isVideo = gorsel?.type === 'video' || currentTemplate.type === 'video';
    const mediaUrl = gorsel?.url || content.video?.url || '';

    try {
      for (const platform of platforms) {
        const currentTexts = texts[platform] || texts['instagram'] || {};
        const caption = currentTexts.caption || '';
        const hashtags = currentTexts.hashtags || [];
        const fullCaption = hashtags.length ? `${caption}\n\n${hashtags.join(' ')}` : caption;
        await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: product.slug, platform, lang,
            caption: fullCaption,
            videoUrl: isVideo ? mediaUrl : '',
            imageUrl: isVideo ? '' : mediaUrl,
          }),
        });
      }
      setCalMsg(`${platforms.length} gönderi takvime eklendi → onay için İçerik Takvimi\'ni aç.`);
    } catch (e) {
      setCalMsg('Takvim hatası: ' + e.message);
    } finally {
      setCalBusy(false);
    }
  }

  // ── Copy section helpers ──
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

  async function genCopy() {
    setCopyBusy(true); setError(null);
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
    setSaveBusy(true);
    try {
      const res = await fetch('/api/content', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.slug, copy: { ...draft, at: new Date().toISOString() } }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setContent((c) => ({ ...c, copy: data.content.copy }));
      setMsg('Reklam metni kaydedildi.');
    } catch (e) { setError('Kaydet: ' + e.message); }
    finally { setSaveBusy(false); }
  }

  const isBusy = genStage !== 'idle' && genStage !== 'ready';
  const hasMedia = Boolean(gorsel?.url || content.video?.url);

  // Kısa durum metni
  const stageLabel = {
    'gen-image': `Görsel üretiliyor… ${elapsed}s`,
    'gen-video': `Video üretiliyor… ${elapsed}s (≈3-5 dk)`,
    'gen-text': 'Metinler yazılıyor…',
    'ready': '',
    'idle': '',
  }[genStage] || '';

  return (
    <div className="mt-3">
      {/* Başlık */}
      <div className="mb-4">
        <h1 className="font-head font-extrabold text-2xl md:text-3xl">{m.name_tr || product.name_en}</h1>
        <div className="text-slate-500 text-sm mt-1">{product.category}{product.specs?.capacity ? ` · ${product.specs.capacity}` : ''}</div>
      </div>

      {error && <div className="card p-3 border-red/40 text-red text-sm mb-4">⚠ {error}</div>}
      {msg && <div className="card p-3 text-ok text-sm mb-4">✓ {msg}</div>}

      {/* ═══════════════ İÇERİK ÜRETİCİ ═══════════════ */}
      <section className="card p-5 mb-6">
        <h2 className="font-head font-bold text-lg mb-4">İçerik Üretici</h2>

        {/* 1) Şablon Seçici */}
        <div className="mb-4">
          <div className="label mb-2">Şablon</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {TEMPLATES.map((t) => {
              const active = activeTemplate === t.id;
              const disabled = t.requiresSoulId;
              return (
                <button
                  key={t.id}
                  onClick={() => !disabled && setActiveTemplate(t.id)}
                  disabled={disabled}
                  title={disabled ? 'Soul ID eğitimi gerekli. Maskot görselini paylaşın.' : t.desc}
                  className={[
                    'rounded-xl border p-3 text-left transition-all',
                    active ? 'border-navy bg-navy/5 ring-2 ring-navy/40' : 'border-line hover:border-navy/30',
                    disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <div className="text-xl mb-1">{t.emoji}</div>
                  <div className="font-semibold text-sm">{t.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{t.desc}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{t.cost}{t.type === 'video' ? ' · video' : ' · görsel'}</div>
                  {disabled && <div className="text-[10px] text-red mt-1">Soul ID gerekli</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2) Platform Seçici */}
        <div className="mb-4">
          <div className="label mb-2">Platform (format otomatik belirlenir)</div>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORMS.map((pl) => (
              <button
                key={pl.id}
                onClick={() => togglePlatform(pl.id)}
                className={`pill ${platforms.includes(pl.id) ? 'pill-active' : 'pill-muted'}`}
              >
                {pl.icon} {pl.label}
                {pl.apiMode === 'assisted' && <span className="text-[10px] ml-1 opacity-60">(manuel)</span>}
              </button>
            ))}
          </div>
          {platforms.length === 0 && <p className="text-xs text-red mt-1">En az bir platform seçin.</p>}
        </div>

        {/* 3) Dil + Üret */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <div className="label mb-1">Dil</div>
            <div className="flex gap-1.5">
              {langs.map((l) => (
                <button key={l} onClick={() => setLang(l)} className={`pill ${l === lang ? 'pill-active' : 'pill-muted'}`}>
                  {LANG_LABEL[l] || l}
                </button>
              ))}
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={isBusy || platforms.length === 0}
          >
            {isBusy ? `⏳ ${stageLabel}` : hasMedia ? '↻ Yeniden üret' : `⚡ Üret (${currentTemplate.emoji} ${currentTemplate.label})`}
          </button>
        </div>

        {/* 4) Önizleme + Metin */}
        {(hasMedia || Object.keys(texts).length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
            {/* Sol: Görsel/Video */}
            <div>
              <div className="label mb-2">Önizleme</div>
              {gorsel?.type === 'video' || currentTemplate.type === 'video' ? (
                <video
                  src={gorsel?.url || content.video?.url}
                  controls
                  className="w-full rounded-xl border border-line bg-black max-h-[400px]"
                  style={{ aspectRatio: '9/16' }}
                />
              ) : gorsel?.url ? (
                <img
                  src={gorsel.url}
                  alt="Üretilen görsel"
                  className="w-full rounded-xl border border-line object-cover max-h-[400px]"
                />
              ) : null}
              {gorsel?.url && (
                <div className="flex gap-2 mt-2">
                  <a href={gorsel.url} target="_blank" rel="noreferrer" className="btn btn-ghost text-sm">⬇ İndir</a>
                  {gorsel?.provider && (
                    <span className="text-[11px] text-slate-400 self-center">{gorsel.provider} · {gorsel.model}</span>
                  )}
                </div>
              )}
            </div>

            {/* Sağ: Platform Metin */}
            <div>
              <div className="label mb-2">Sosyal Medya Metni</div>
              {platforms.map((platform) => {
                const pt = texts[platform];
                if (!pt) return null;
                return (
                  <div key={platform} className="mb-4 last:mb-0">
                    <div className="text-xs font-semibold text-slate-500 mb-1">
                      {ALL_PLATFORMS.find((p) => p.id === platform)?.icon} {platform.toUpperCase()}
                    </div>
                    {pt.error ? (
                      <p className="text-xs text-red">{pt.error}</p>
                    ) : (
                      <>
                        <textarea
                          className="textarea text-sm"
                          rows={4}
                          defaultValue={pt.caption}
                          readOnly={false}
                        />
                        {pt.hashtags?.length > 0 && (
                          <div className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                            {pt.hashtags.join(' ')}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              {Object.keys(texts).length === 0 && (
                <p className="text-slate-400 text-sm">Metin üretildiğinde burada görünür.</p>
              )}
            </div>
          </div>
        )}

        {/* 5) Paylaşım Butonları */}
        {hasMedia && genStage === 'ready' && (
          <div className="mt-5 pt-4 border-t border-line">
            <div className="flex flex-wrap gap-3 items-start">
              {/* Acil Paylaş */}
              <div>
                <div className="label mb-2">🚀 Acil Paylaş (onay yok)</div>
                <div className="flex flex-wrap gap-2">
                  {platforms.map((platform) => {
                    const pl = ALL_PLATFORMS.find((p) => p.id === platform);
                    return (
                      <button
                        key={platform}
                        onClick={() => { setPublishPlatform(platform); handleQuickPublish(platform); }}
                        disabled={publishBusy}
                        className="btn btn-primary text-sm"
                      >
                        {publishBusy && publishPlatform === platform ? 'Gönderiliyor…' : `${pl?.icon} ${pl?.label}'e gönder`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Takvime Ekle */}
              <div>
                <div className="label mb-2">📅 Takvime Ekle (onaylı)</div>
                <button className="btn btn-ghost text-sm" onClick={handleAddToCalendar} disabled={calBusy}>
                  {calBusy ? 'Ekleniyor…' : '📅 Takvime ekle (taslak)'}
                </button>
                {calMsg && <span className="text-xs text-slate-600 ml-2">{calMsg}</span>}
              </div>
            </div>

            {/* Paylaşım sonucu */}
            {publishResult && (
              <div className={`mt-3 card p-3 text-sm ${publishResult.method === 'assisted' ? 'border-amber-400/40 text-amber-700' : 'text-ok'}`}>
                {publishResult.method === 'assisted' ? (
                  <>
                    <strong>Manuel adımlar ({publishResult.platform}):</strong>{' '}
                    {publishResult.pkg?.instructions}
                    {publishResult.pkg?.videoUrl && (
                      <div className="mt-1"><a href={publishResult.pkg.videoUrl} target="_blank" rel="noreferrer" className="underline">Video linkini aç</a></div>
                    )}
                  </>
                ) : (
                  `✓ ${publishResult.platform.toUpperCase()}\'de yayınlandı!`
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ═══════════════ REKLAM METNİ (Mevcut copy sistemi) ═══════════════ */}
      <section className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-head font-bold">Reklam Metni <span className="text-xs font-normal text-slate-400">(reklam varyantları, düzenlenebilir)</span></h2>
          <button className="btn btn-primary text-sm" onClick={genCopy} disabled={copyBusy}>
            {copyBusy ? 'Üretiliyor…' : draft ? '↻ Yeniden üret' : '✍ Metin üret'}
          </button>
        </div>

        {draft?.highlights?.length > 0 && (
          <div className="mb-3">
            <div className="label">Öne çıkan özellikler</div>
            <div className="flex flex-wrap gap-1.5">{draft.highlights.map((h, i) => <span key={i} className="pill pill-ok">{h}</span>)}</div>
          </div>
        )}

        {!draft && <p className="text-slate-500 text-sm">Fiyatsız, özellik-kancalı 4 varyant üretilecek (A-D).</p>}

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
                <button className="btn btn-ghost text-sm" onClick={saveCopy} disabled={saveBusy}>{saveBusy ? 'Kaydediliyor…' : '💾 Kaydet'}</button>
              </div>
            ) : <p className="text-slate-500 text-sm">Bu dil için veri yok.</p>}
          </>
        )}
      </section>

      {/* Aşamalı üretim hattı (Faz 2) */}
      <PipelinePanel slug={product.slug} languages={langs} />

      {/* Varlık Kütüphanesi (Faz 3) */}
      <AssetLibrary slug={product.slug} />
    </div>
  );
}
