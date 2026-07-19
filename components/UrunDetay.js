'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AssetLibrary from './AssetLibrary';
import WorkflowBar from './WorkflowBar';
import { IMAGE_CONCEPTS } from '@/lib/image-concepts';
import { tierSummary, DEFAULT_TIER } from '@/lib/quality-tiers';
import { websiteBriefSource } from '@/lib/website-brief';
import { useOnayModal } from './OnayModal';

// Kalite tier'ları (client-güvenli; quality-tiers.js saf JS). Maliyet farkı UI'da görünür.
const IMAGE_TIER_LIST = tierSummary('image');
const VIDEO_TIER_LIST = tierSummary('video');

const LANG_LABEL = { tr: 'TR', en: 'EN', ar: 'AR', fr: 'FR', ru: 'RU' };
// Tüm desteklenen diller — içerik/video/reklam her dilde üretilebilir (ürün ayarından bağımsız).
const ALL_LANGS = ['tr', 'en', 'ar', 'fr', 'ru'];

// Sosyal medya içerik açıları (post-text.js SOCIAL_CONCEPTS ile eş — client-güvenli kopya).
const SOCIAL_CONCEPTS = [
  { id: 'tanitim',  label: '📢 Tanıtım' },
  { id: 'sorun',    label: '🔧 Sorun-Çözüm' },
  { id: 'sosyal',   label: '⭐ Güven/Referans' },
  { id: 'egitim',   label: '💡 Eğitici' },
  { id: 'aciliyet', label: '🔥 Harekete Geçir' },
  { id: 'sahne',    label: '🏭 Sahne Arkası' },
];

const TABS = [
  { id: 'brief',  label: '📋 Brief'  },
  { id: 'gorsel', label: '🖼️ Görsel' },
  { id: 'icerik', label: '✍️ İçerik' },
  { id: 'video',  label: '🎬 Video'  },
  { id: 'reklam', label: '📣 Reklam Metni' },
];


const VIDEO_PLATFORMS = [
  { id: 'reels',    label: 'Instagram Reels', icon: '📱', ratio: '9:16',  defaultDur: 15 },
  { id: 'stories',  label: 'Stories',          icon: '📸', ratio: '9:16',  defaultDur: 10 },
  { id: 'youtube',  label: 'YouTube',          icon: '▶️', ratio: '16:9', defaultDur: 20 },
  { id: 'linkedin', label: 'LinkedIn',         icon: '💼', ratio: '16:9', defaultDur: 20 },
];

const VOICE_STYLES = [
  { id: 'satis',  label: '🔥 Satış Odaklı', desc: 'Hızlı, enerjik, tetikleyici' },
  { id: 'bilgi',  label: 'ℹ️ Bilgilendirici', desc: 'Sakin, net, profesyonel' },
  { id: 'maskot', label: '🤖 Maskot Sesi',   desc: 'Robot karakteri, OpenAI onyx' },
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
  const router = useRouter();
  const m = product.marketing || {};
  const langs = m.languages?.length ? m.languages : ['tr', 'en'];

  const [tab, setTab] = useState('brief');
  const [content, setContent] = useState(initialContent || {});
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [calCount, setCalCount] = useState(0);
  const [onayModal, onayIste] = useOnayModal(); // marka-uyumlu para-onay (native confirm yerine)

  // ── Brief ──
  const [brief, setBrief] = useState(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefMsg, setBriefMsg] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFile, setImportFile] = useState(null);

  // ── Görsel ──
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [activeTemplate, setActiveTemplate] = useState('makine-vitrin');
  const [activeConcept, setActiveConcept] = useState('vitrin');
  const [imageProvider, setImageProvider] = useState('fal'); // 'fal' | 'higgsfield' — görsel motoru
  const [imageTier, setImageTier] = useState(DEFAULT_TIER);   // economy|standard|premium — VARSAYILAN premium
  const [customPrompt, setCustomPrompt] = useState('');
  const [libCounts, setLibCounts] = useState({});
  const [gorselBusy, setGorselBusy] = useState(false);
  const [gorsel, setGorsel] = useState(null);
  const [reklamSyncBusy, setReklamSyncBusy] = useState(false);
  const [libRefresh, setLibRefresh] = useState(0); // AssetLibrary'yi yeniden mount etmek için

  // ── İçerik ──
  const [platforms, setPlatforms] = useState(['instagram']);
  const [lang, setLang] = useState(langs[0]);
  const [socialConcept, setSocialConcept] = useState('tanitim');
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
  const [videoPlatform, setVideoPlatform] = useState('reels');
  const [videoDuration, setVideoDuration] = useState(15);
  const [videoTier, setVideoTier] = useState(DEFAULT_TIER);   // economy|standard|premium — VARSAYILAN premium
  const [voiceStyle, setVoiceStyle] = useState('satis');
  // ── Manuel medya yükleme (kendi video/görselini yükle) ──
  const [manualFile, setManualFile] = useState(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualMsg, setManualMsg] = useState(null);

  // ── Reklam copy ──
  const [copyBusy, setCopyBusy] = useState(false);
  const [draft, setDraft] = useState(null);
  const [activeVariant, setActiveVariant] = useState('A');
  const [activeLang, setActiveLang] = useState(langs[0]);
  const [saveBusy, setSaveBusy] = useState(false);

  // ── Hazır içerik ekle (HF ID / dosya / URL) + kalan kredi ──
  const [addSource, setAddSource] = useState('hf-id'); // 'hf-id' | 'dosya' | 'url'
  const [addValue, setAddValue] = useState('');
  const [addFile, setAddFile] = useState(null);
  const [addLang, setAddLang] = useState(langs[0]);
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState(null);
  const [addPreview, setAddPreview] = useState(null); // { url, type }
  const [credits, setCredits] = useState(null);
  const [accountOk, setAccountOk] = useState(true); // Higgsfield oturumu sağlam mı (ID yolu için)

  // Yükle: ilk content'ten state
  useEffect(() => {
    if (content.gorsel) setGorsel(content.gorsel);
    if (content.metin?.texts) setTexts(content.metin.texts);
    if (content.video) setVideoResult(content.video);
  }, []); // eslint-disable-line

  // Higgsfield kalan kredi (rozet + kredi onay diyaloğu için)
  useEffect(() => {
    fetch('/api/higgsfield/account')
      .then((r) => r.json())
      .then((d) => { setAccountOk(Boolean(d.ok)); if (d.ok && typeof d.credits === 'number') setCredits(d.credits); })
      .catch(() => setAccountOk(false));
  }, []);

  useEffect(() => {
    setDraft(content.copy ? JSON.parse(JSON.stringify(content.copy)) : null);
  }, [content.copy]);

  // Kütüphaneden konsept kullanım sayıları
  useEffect(() => {
    fetch(`/api/assets?slug=${product.slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        const counts = {};
        d.assets.filter((a) => a.type === 'gorsel').forEach((a) => {
          const tag = a.concept || a.template || '';
          IMAGE_CONCEPTS.forEach((c) => {
            if (tag === c.id || (c.templateId && tag === c.templateId)) {
              counts[c.id] = (counts[c.id] || 0) + 1;
            }
          });
        });
        setLibCounts(counts);
      }).catch(() => {});
  }, [product.slug]); // eslint-disable-line

  useEffect(() => () => clearInterval(videoTimerRef.current), []);

  // ── Brief metni taslak koruması (localStorage + beforeunload) ──────────────
  // Uzun yapıştırılan brief metni yanlışlıkla kaybolmasın (sekme kapama/yenileme).
  const draftKey = `brief-import-draft:${product.slug}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved && !importText) setImportText(saved);
    } catch { /* localStorage yoksa sorun değil */ }
  }, []); // eslint-disable-line
  useEffect(() => {
    try {
      if (importText.trim()) localStorage.setItem(draftKey, importText);
      else localStorage.removeItem(draftKey);
    } catch { /* */ }
    const onBeforeUnload = (e) => {
      if (importText.trim()) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [importText]); // eslint-disable-line

  // Brief yükle
  useEffect(() => {
    fetch(`/api/brief?slug=${product.slug}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok && d.brief) setBrief(d.brief); })
      .catch(() => {});
  }, [product.slug]);

  // Takvimde bu ürüne ait gönderi sayısı (workflow "Yayın" aşaması için)
  useEffect(() => {
    fetch('/api/calendar')
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCalCount((d.items || []).filter((it) => it.slug === product.slug).length); })
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

  // ── Brief import (PDF / metin) ──
  async function handleBriefImport() {
    if (!importText.trim() && !importFile) return;
    setImportBusy(true); setBriefMsg(null);
    try {
      const fd = new FormData();
      fd.append('slug', product.slug);
      if (importText.trim()) fd.append('text', importText.trim());
      if (importFile) fd.append('file', importFile);
      const res = await fetch('/api/brief/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setBrief(d.brief);
      setImportText('');
      setImportFile(null);
      setBriefMsg('AI brief doldurdu — gözden geçir ve kaydet ✓');
    } catch (e) { setBriefMsg('⚠ ' + e.message); }
    finally { setImportBusy(false); }
  }

  // ── Brief'i web sitesi verisinden üret (website-sync'in getirdiği blok) ──
  // mode=website: kaynak metni SUNUCU taze senkron verisinden kurar, GPT topraklamalı
  // çalışır (sitede olmayan bilgi yazamaz); OPENAI anahtarı yoksa LLM'siz derlenir.
  async function handleBriefFromWebsite() {
    if (!product.website) { setBriefMsg('⚠ Bu ürün web sitesine bağlı değil — önce Siteyle Eşitle.'); return; }
    setImportBusy(true); setBriefMsg(null);
    try {
      const fd = new FormData();
      fd.append('slug', product.slug);
      fd.append('mode', 'website');
      const res = await fetch('/api/brief/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setBrief(d.brief);
      setBriefMsg(d.note ? `${d.note} — gözden geçir ve kaydet ✓` : 'Sitedeki gerçek veriden brief üretildi — gözden geçir ve kaydet ✓');
    } catch (e) { setBriefMsg('⚠ ' + e.message); }
    finally { setImportBusy(false); }
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
      const concept = IMAGE_CONCEPTS.find((c) => c.id === activeConcept) || IMAGE_CONCEPTS[0];
      const templateId = concept.templateId || 'makine-vitrin';
      const d = await postGuarded('/api/generate/gorsel', {
        slug: product.slug, template: templateId, lang: langs[0],
        platforms: ['instagram'], concept: activeConcept,
        customPrompt: concept.isCustom ? customPrompt : undefined,
        provider: imageProvider,
        tier: imageTier,
        force: true,
      });
      if (d.cancelled) { setMsg(d.error); return; }
      if (!d.ok) throw new Error(d.error);
      setGorsel(d.gorsel);
      setContent((c) => ({ ...c, gorsel: d.gorsel }));
      setLibCounts((prev) => ({ ...prev, [activeConcept]: (prev[activeConcept] || 0) + 1 }));
      setMsg(d.gorsel.imageSource === 'img2img' ? 'Görsel üretildi (makine fotoğrafından) ✓' : 'Görsel üretildi ✓');
    } catch (e) { setError('Görsel hatası: ' + e.message); }
    finally { setGorselBusy(false); }
  }

  // ── Reklam creative'lerini içe aktar (reklam/campaigns → kütüphane) ──
  async function handleReklamSync() {
    setReklamSyncBusy(true); setError(null);
    try {
      const res = await fetch('/api/reklam-sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.slug }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setMsg(d.imported > 0 ? `${d.imported} reklam görseli/videosu içe aktarıldı ✓` : 'Yeni reklam içeriği yok (hepsi zaten panelde).');
      setLibRefresh((n) => n + 1);   // Varlık Kütüphanesi'ni tazele
      router.refresh();              // ana görsel / server içeriğini tazele
    } catch (e) { setError('Reklam içe aktarma hatası: ' + e.message); }
    finally { setReklamSyncBusy(false); }
  }

  // ── Metin üret ──
  async function handleGenText() {
    if (platforms.length === 0) { setError('En az bir platform seçin.'); return; }
    setTextBusy(true); setError(null);
    try {
      const d = await postGuarded('/api/generate/metin', {
        slug: product.slug, lang, platforms, template: 'makine-vitrin', concept: socialConcept,
      });
      if (d.cancelled) { setMsg(d.error); return; }
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
      const d = await postGuarded('/api/generate/video', {
        slug: product.slug, lang: videoLang, voice: wantVoice, music: false,
        duration: videoDuration, aspect_ratio: VIDEO_PLATFORMS.find((p) => p.id === videoPlatform)?.ratio || '9:16',
        platform: videoPlatform, voiceStyle, tier: videoTier, force: true,
      });
      if (d.cancelled) { setMsg(d.error); return; }
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

  // ── Manuel medya yükle (kendi hazırladığın video/görsel) ──
  async function handleManualUpload() {
    if (!manualFile) return;
    setManualBusy(true); setManualMsg(null); setError(null);
    try {
      const fd = new FormData();
      fd.append('slug', product.slug);
      fd.append('file', manualFile);
      fd.append('lang', videoLang);
      const res = await fetch('/api/library/upload', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setManualFile(null);
      setManualMsg(`Yüklendi ✓ — Varlık Kütüphanesi'nde, oradan Takvime ekleyip paylaşabilirsin.`);
    } catch (e) { setError('Yükleme hatası: ' + e.message); }
    finally { setManualBusy(false); }
  }

  // ── Hazır içerik ekle: HF ID / URL → /api/library/import, dosya → /api/library/upload ──
  async function handleReadyAdd() {
    setAddBusy(true); setAddMsg(null); setError(null);
    try {
      let d;
      if (addSource === 'dosya') {
        if (!addFile) { setAddMsg('Önce bir dosya seçin.'); return; }
        const fd = new FormData();
        fd.append('slug', product.slug);
        fd.append('file', addFile);
        fd.append('lang', addLang);
        const res = await fetch('/api/library/upload', { method: 'POST', body: fd });
        d = await res.json();
      } else {
        if (!addValue.trim()) { setAddMsg(addSource === 'hf-id' ? 'Higgsfield iş ID girin.' : 'Geçerli bir URL girin.'); return; }
        const res = await fetch('/api/library/import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: product.slug, source: addSource, value: addValue.trim(), lang: addLang }),
        });
        d = await res.json();
      }
      if (!d.ok) throw new Error(d.error);
      setAddPreview({ url: d.url, type: d.type });
      // Eklenen medya artık ürünün ana görseli/videosu → iş akışı + önizleme anında güncellenir.
      const at = new Date().toISOString();
      if (d.type === 'video') {
        const v = { url: d.url, localPath: d.url, type: 'manuel', lang: addLang, manual: true, at };
        setVideoResult(v); setContent((c) => ({ ...c, video: v }));
      } else {
        const g = { url: d.url, localPath: d.url, imageSource: addSource === 'dosya' ? 'manuel-yükleme' : addSource, manual: true, at };
        setGorsel(g); setContent((c) => ({ ...c, gorsel: g }));
      }
      setAddValue(''); setAddFile(null);
      setAddMsg('Eklendi ✓ — Bu artık ürünün ana ' + (d.type === 'video' ? 'videosu' : 'görseli') + '. Kütüphaneye düştü; Takvime ekleyip onayla paylaşabilirsin.');
    } catch (e) { setError('Ekleme hatası: ' + e.message); }
    finally { setAddBusy(false); }
  }

  // ── Üretim çağrısı (kredi koruması): manuel modda 402 requiresConfirm dönerse onay iste ──
  async function postGuarded(url, body) {
    const send = (extra) => fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, ...extra }),
    });
    let res = await send();
    if (res.status === 402) {
      let g = {}; try { g = await res.json(); } catch { /* */ }
      if (g.requiresConfirm) {
        const kredi = g.credits ?? credits ?? '?';
        // İşlem türüne göre tier + tahmini maliyeti göster (bilinçli para kararı).
        const isVideo = /video/.test(url);
        const tierId = body.tier || (isVideo ? videoTier : imageTier);
        const tierObj = (isVideo ? VIDEO_TIER_LIST : IMAGE_TIER_LIST).find((t) => t.id === tierId);
        const ok = await onayIste({
          baslik: isVideo ? 'Video üretimi' : 'Görsel üretimi',
          mesaj: 'Bu işlem Higgsfield/fal kredisi yakar. Manuel mod açık — önerilen yol: '
            + 'Higgsfield\'de üretip "Hazır İçerik Ekle" ile getirmek. Yine de panelde üretilsin mi?',
          tier: tierObj ? tierObj.label : (tierId || '—'),
          kredi,
          maliyet: tierObj?.costLabel,
          onayLabel: isVideo ? 'Videoyu üret (kredi)' : 'Görseli üret (kredi)',
          ipucu: 'Ekonomi tier daha az kredi yakar; kalite ihtiyacına göre seçilebilir.',
        });
        if (!ok) return { ok: false, cancelled: true, error: 'İptal edildi — kredi harcanmadı.' };
        res = await send({ confirmSpend: true });
      }
    }
    return res.json();
  }

  // ── Hazır içerik ekle paneli (görsel + video sekmelerinde) ──
  function renderReadyAdd() {
    return (
      <section className="card p-5 border-ok/30 bg-ok/5">
        <h2 className="font-head font-bold mb-1">✅ Hazır İçerik Ekle <span className="text-xs font-normal text-slate-500">(önerilen — panelde kredi yakmaz)</span></h2>
        <p className="text-sm text-slate-500 mb-4">
          Görsel/videoyu Higgsfield'de kendin üret ve kaliteyi orada gör; sonra işe yarayanı buraya getir.
          İçerik Varlık Kütüphanesi'ne düşer → Takvime ekleyip onayla paylaşırsın.
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {[['hf-id', '🎯 Higgsfield ID'], ['dosya', '📁 Dosya'], ['url', '🔗 URL']].map(([id, label]) => (
            <button key={id} onClick={() => { setAddSource(id); setAddMsg(null); }}
              className={`pill ${addSource === id ? 'pill-active' : 'pill-muted'}`}>{label}</button>
          ))}
          <span className="ml-auto flex flex-wrap gap-1.5">
            {ALL_LANGS.map((l) => (
              <button key={l} onClick={() => setAddLang(l)} className={`pill text-xs ${l === addLang ? 'pill-active' : 'pill-muted'}`}>{LANG_LABEL[l] || l}</button>
            ))}
          </span>
        </div>

        {addSource === 'hf-id' && (
          <div>
            {!accountOk && (
              <p className="text-[11px] text-amber bg-amber/10 border border-amber/30 rounded-lg p-2 mb-2">
                ⚠ Higgsfield oturumu şu an kapalı/süresi dolmuş — ID ile ekleme çalışmayabilir. Bu arada <strong>Dosya</strong> veya <strong>URL</strong> kullan.
              </p>
            )}
            <input className="input w-full" placeholder="Higgsfield iş ID'si (ör. 79497836-762a-42c4-...)"
              value={addValue} onChange={(e) => setAddValue(e.target.value)} />
            <p className="text-[11px] text-slate-500 mt-1">Higgsfield'de ürettiğin işi aç → ID'yi kopyala → yapıştır. (Sistem aynı hesapla giriş yapmış olmalı.)</p>
          </div>
        )}
        {addSource === 'url' && (
          <input className="input w-full" placeholder="https://… .png / .jpg / .webp / .mp4"
            value={addValue} onChange={(e) => setAddValue(e.target.value)} />
        )}
        {addSource === 'dosya' && (
          <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm" className="text-sm"
            onChange={(e) => setAddFile(e.target.files?.[0] || null)} />
        )}

        <button className="btn btn-primary mt-3" onClick={handleReadyAdd} disabled={addBusy}>
          {addBusy ? '⏳ Ekleniyor…' : '⬇ Panele Ekle'}
        </button>
        {addMsg && <p className="text-xs text-ok mt-2">{addMsg}</p>}
        {addPreview?.url && (
          <div className="mt-3">
            {addPreview.type === 'video'
              ? <video src={addPreview.url} controls className="w-full max-w-xs rounded-xl border border-line bg-black" />
              : <img src={addPreview.url} alt="eklenen" className="w-full max-w-xs rounded-xl border border-line" />}
          </div>
        )}
      </section>
    );
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
      const d = await postGuarded('/api/generate/copy', { slug: product.slug, languages: ALL_LANGS });
      if (d.cancelled) { setMsg(d.error); return; }
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

  // ── Workflow aşamaları (durum mevcut state'ten) ──
  const wf = {
    brief:  Boolean(brief?.approved),
    gorsel: Boolean(content.gorsel?.url || gorsel?.url),
    icerik: Object.keys(texts).length > 0 || Boolean(content.metin?.texts),
    video:  Boolean(content.video?.url || videoResult?.url),
    reklam: Boolean(content.copy?.variants?.length || draft?.variants?.length),
    yayin:  calCount > 0,
  };
  const workflowSteps = [
    { id: 'brief',  label: 'Brief',  done: wf.brief,  hint: 'Ürün bilgisi ve öne çıkanlar' },
    { id: 'gorsel', label: 'Görsel', done: wf.gorsel, hint: 'Ürün görseli üret' },
    { id: 'icerik', label: 'İçerik', done: wf.icerik, hint: 'Sosyal medya metni' },
    { id: 'video',  label: 'Video',  done: wf.video,  hint: 'Tanıtım videosu' },
    { id: 'reklam', label: 'Reklam Metni', done: wf.reklam, hint: 'Reklam metinleri' },
    { id: 'yayin',  label: 'Yayın',  done: wf.yayin,  hint: 'Takvime ekle ve onayla' },
  ];
  const nextStep = workflowSteps.find((s) => !s.done);
  const onWorkflowStep = (s) => { if (s.id === 'yayin') router.push('/takvim'); else setTab(s.id); };
  const stepCTA = {
    brief: 'Brief\'i doldur ve onayla', gorsel: 'Şimdi görsel üret', icerik: 'Sosyal medya metni üret',
    video: 'Tanıtım videosu üret', reklam: 'Reklam kopyası üret', yayin: 'Takvime ekle ve yayına hazırla',
  };

  return (
    <div className="mt-3">
      {onayModal}
      {/* Başlık */}
      <div className="mb-5 flex items-start gap-4">
        {(content.gorsel?.localPath || content.gorsel?.url) && (
          <img src={content.gorsel?.localPath || content.gorsel?.url} alt="Ürün" className="w-14 h-14 rounded-xl object-cover border border-line shrink-0" />
        )}
        <div>
          <h1 className="font-head font-extrabold text-2xl md:text-3xl">{m.name_tr || product.name_en}</h1>
          <div className="text-slate-500 text-sm mt-1">{product.category}{product.specs?.capacity ? ` · ${product.specs.capacity}` : ''}</div>
        </div>
      </div>

      {/* Workflow aşama çubuğu */}
      <WorkflowBar steps={workflowSteps} activeId={tab} onStep={onWorkflowStep} />

      {/* Sıradaki adım yönlendirmesi */}
      {nextStep ? (
        <div className="card p-3 mb-4 flex items-center justify-between gap-3 border-red/20 bg-red/5">
          <div className="text-sm text-navy">
            <span className="font-semibold">Sıradaki adım:</span> {stepCTA[nextStep.id]}
          </div>
          <button className="btn btn-primary text-sm shrink-0" onClick={() => onWorkflowStep(nextStep)}>
            {nextStep.label} →
          </button>
        </div>
      ) : (
        <div className="card p-3 mb-4 text-sm text-ok bg-ok/5 border-ok/20">
          ✓ Tüm aşamalar tamam — içerik takvimde yayına hazır.
        </div>
      )}

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
                <p className="text-sm text-slate-500">Henüz özellik eklenmedi. Brief AI tarafından otomatik doldurulabilir.</p>
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
            <label className="label mb-1">Kesinlikle söylenmeyecekler <span className="font-normal text-slate-500">(virgülle ayır)</span></label>
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

          {/* Web sitesi verisinden otomatik brief — kaynak sitedeki GERÇEK içeriktir */}
          {product.website && (
            <div className="border border-line rounded-xl px-4 py-3 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="btn btn-ghost text-sm"
                  onClick={handleBriefFromWebsite}
                  disabled={importBusy}
                  title="Sitedeki gerçek ürün içeriğinden (açıklama, özellikler, SSS…) brief üretir — sitede olmayan bilgi yazılmaz"
                >
                  {importBusy ? '⏳ Site verisi işleniyor…' : '🌐 Siteden Brief Çek'}
                </button>
                <a href={product.website.url} target="_blank" rel="noreferrer" className="text-xs text-slate-500 underline">
                  sitedeki ürün sayfası ↗
                </a>
                {product.website.syncedAt && (
                  <span className="text-xs text-slate-400">
                    son eşitleme: {new Date(product.website.syncedAt).toLocaleString('tr-TR')}
                  </span>
                )}
              </div>
              <details>
                <summary className="cursor-pointer select-none text-xs text-slate-500 hover:text-slate-700">
                  📄 Siteden çekilen içeriği gör (brief'in kaynağı)
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-line">
                  {websiteBriefSource(product) || 'Site içeriği henüz eşitlenmedi.'}
                </pre>
              </details>
            </div>
          )}

          {/* PDF / Metin import */}
          <details className="border border-line rounded-xl">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm text-slate-500 hover:text-slate-700">
              📎 PDF veya Metin ile Otomatik Doldur
            </summary>
            <div className="px-4 pb-4 space-y-3 border-t border-line pt-3">
              <textarea
                className="input w-full text-sm"
                rows={5}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Ürün teknik dokümanı, katalog metni veya müşteri notunu yapıştırın…"
              />
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span>veya dosya:</span>
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  className="text-sm"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                {importFile && <span className="text-xs text-slate-500">{importFile.name}</span>}
              </div>
              <button
                className="btn btn-primary text-sm"
                onClick={handleBriefImport}
                disabled={importBusy || (!importText.trim() && !importFile)}
              >
                {importBusy ? '⏳ AI analiz ediyor…' : '⚡ AI ile Doldur'}
              </button>
              <p className="text-xs text-slate-500">AI çıktıyı gözden geçir, düzenle, ardından kaydet.</p>
            </div>
          </details>

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
          {/* Reklam kampanyası creative'lerini içe aktar (otomatik de gelir; bu manuel tazeleme) */}
          <section className="card p-4 flex flex-wrap items-center justify-between gap-3 border-navy/20 bg-navy/3">
            <div className="text-sm text-slate-600">
              📣 <strong>Reklam görselleri</strong> — kampanyada üretilenler bu ürüne otomatik gelir. Yenilemek için:
            </div>
            <button className="btn btn-ghost text-sm shrink-0" onClick={handleReklamSync} disabled={reklamSyncBusy}>
              {reklamSyncBusy ? '⏳ Aktarılıyor…' : '↻ Reklam görsellerini içe aktar'}
            </button>
          </section>

          {/* Hazır içerik ekle — ana (önerilen) yol */}
          {renderReadyAdd()}

          {/* Aktif ürün görseli (eklenen/üretilen) — tek görsel kaynağı */}
          {(content.gorsel?.localPath || content.gorsel?.url || gorselUrl) && (
            <section className="card p-4">
              <div className="text-xs text-slate-500 mb-2">Bu ürünün aktif görseli (yayın + video/AI kaynağı):</div>
              <img src={content.gorsel?.localPath || content.gorsel?.url || gorselUrl} alt="aktif görsel"
                className="w-full max-w-sm rounded-xl border border-line" />
              <div className="text-[11px] text-slate-500 mt-1">
                Kaynak: {content.gorsel?.imageSource || gorsel?.imageSource || '—'}{content.gorsel?.manual ? ' · manuel eklendi' : ''}
              </div>
            </section>
          )}

          {/* AI üret — gelişmiş/ikincil (motor seçilebilir: fal.ai / Higgsfield), varsayılan kapalı */}
          <details className="card p-0 overflow-hidden">
            <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold text-slate-600 hover:text-navy">
              ⚙️ Gelişmiş: AI ile görsel üret <span className="font-normal text-amber">{imageProvider === 'higgsfield' ? '(kredi + Higgsfield oturumu gerekir)' : '(fal.ai · kredi)'}</span>
            </summary>
            <div className="px-5 pb-5 border-t border-line pt-4">
            {/* Motor seçimi: fal.ai (varsayılan) / Higgsfield */}
            <div className="mb-3">
              <span className="label mb-1 block">Görsel motoru</span>
              <div className="flex flex-wrap gap-1.5">
                {[['fal', '⚡ fal.ai'], ['higgsfield', '🌀 Higgsfield']].map(([id, lbl]) => (
                  <button key={id} onClick={() => setImageProvider(id)}
                    className={`pill ${imageProvider === id ? 'pill-active' : 'pill-muted'}`}>{lbl}</button>
                ))}
              </div>
              {imageProvider === 'higgsfield' && !accountOk && (
                <p className="text-[11px] text-amber bg-amber/10 border border-amber/30 rounded-lg p-2 mt-2">
                  ⚠ Higgsfield oturumu kapalı/süresi dolmuş olabilir — fal.ai'ye otomatik düşer ya da fal'ı seç.
                </p>
              )}
            </div>

            {/* KALİTE TIER — varsayılan PREMIUM (Asaf kalite kararı). Maliyet farkı görünür. */}
            <div className="mb-3">
              <span className="label mb-1 block">Kalite tier'ı <span className="font-normal text-slate-500">(maliyet farkı görünür)</span></span>
              <div className="flex flex-wrap gap-1.5">
                {IMAGE_TIER_LIST.map((t) => {
                  const model = imageProvider === 'higgsfield' ? t.hfModel : t.falModel;
                  return (
                    <button key={t.id} onClick={() => setImageTier(t.id)}
                      title={`${t.desc} · model: ${model} · maliyet ${t.costLabel}`}
                      className={`pill ${imageTier === t.id ? 'pill-active' : 'pill-muted'}`}>
                      {t.label} <span className="opacity-60">· {t.costLabel}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Seçili: <strong>{IMAGE_TIER_LIST.find((t) => t.id === imageTier)?.label}</strong> →
                model <strong>{imageProvider === 'higgsfield'
                  ? IMAGE_TIER_LIST.find((t) => t.id === imageTier)?.hfModel
                  : IMAGE_TIER_LIST.find((t) => t.id === imageTier)?.falModel}</strong>
                {imageTier === 'premium' ? ' · en yüksek kalite (varsayılan)' : ''}
              </p>
            </div>
            {imageProvider === 'higgsfield' && credits != null && <p className="text-[11px] text-slate-500 mb-2">Higgsfield kalan kredi: <strong>{credits}</strong></p>}
            <p className="text-xs text-slate-500 mb-3">Önerilen yol yukarıdaki “Hazır İçerik Ekle”. Burada panel kredi/ücret yakarak üretir; eklediğin görsel varsa img2img kaynağı olur (gerçek makineye sadık kalır).</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {IMAGE_CONCEPTS.map((c) => {
                const isActive = activeConcept === c.id;
                const count = libCounts[c.id] || 0;
                return (
                  <button key={c.id}
                    onClick={() => { setActiveConcept(c.id); if (c.templateId) setActiveTemplate(c.templateId); }}
                    className={[
                      'rounded-xl border p-3 text-left transition-all relative',
                      isActive ? 'border-navy bg-navy/5 ring-2 ring-navy/40' : 'border-line hover:border-navy/30',
                    ].join(' ')}>
                    {count > 0 && (
                      <span className="absolute top-2 right-2 text-[10px] bg-slate-100 text-slate-500 rounded-full px-1.5">{count}×</span>
                    )}
                    <div className="text-xl mb-1">{c.emoji}</div>
                    <div className="font-semibold text-xs">{c.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{c.desc}</div>
                    {c.requiresSoulId && <div className="text-[9px] text-ok mt-1">● Soul ID aktif</div>}
                  </button>
                );
              })}
            </div>

            {/* Özel prompt alanı — sadece "Özel" konsept seçilince görünür */}
            {activeConcept === 'ozel' && (
              <textarea className="textarea mb-3" rows={2} value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Görsel için özel açıklama: ortam, renk, ışık, kompozisyon…" />
            )}

            <button className="btn btn-ghost" onClick={handleGenGorsel} disabled={gorselBusy}>
              {gorselBusy ? '⏳ Üretiliyor…' : gorselUrl ? '↻ Yeniden üret (kredi)' : '⚡ Görsel Üret (kredi)'}
            </button>

            {gorselUrl && (
              <div className="mt-4">
                <img src={gorselUrl} alt="Üretilen görsel" className="w-full max-w-sm rounded-xl border border-line" />
                <div className="text-xs text-slate-500 mt-1">
                  {gorsel?.imageSource === 'img2img' ? '✓ img2img (makine korundu)' : 'text2img'}
                  {gorsel?.localPath ? ' · yerel kopya' : ' · CDN'}
                  {gorsel?.provider ? ` · ${gorsel.provider}` : ''}
                </div>
                <a href={gorselUrl} download className="btn btn-ghost text-sm mt-2 inline-block">⬇ İndir</a>
              </div>
            )}
            </div>
          </details>
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

          {/* İçerik açısı / konsept */}
          <div>
            <label className="label mb-2">İçerik açısı</label>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_CONCEPTS.map((c) => (
                <button key={c.id} onClick={() => setSocialConcept(c.id)}
                  className={`pill ${socialConcept === c.id ? 'pill-active' : 'pill-muted'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label mb-1">Dil</label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_LANGS.map((l) => (
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
                        <textarea key={`${platform}-${lang}-${pt.caption?.slice(0, 12)}`}
                          className="textarea text-sm leading-relaxed" rows={8} defaultValue={pt.caption} />
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
        <div className="space-y-5">
        {/* Hazır içerik ekle — ana (önerilen) yol */}
        {renderReadyAdd()}

        {/* Aktif ürün videosu (eklenen/üretilen) */}
        {(content.video?.localPath || content.video?.url || videoUrl) && (
          <section className="card p-4">
            <div className="text-xs text-slate-500 mb-2">Bu ürünün aktif videosu:</div>
            <video src={content.video?.localPath || content.video?.url || videoUrl} controls
              className="w-full max-w-xs rounded-xl border border-line bg-black" />
          </section>
        )}

        {/* AI video üret — gelişmiş/ikincil (kredi + oturum gerekir), varsayılan kapalı */}
        <details className="card p-0 overflow-hidden">
          <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold text-slate-600 hover:text-navy">
            ⚙️ Gelişmiş: AI ile video üret <span className="font-normal text-amber">(kredi + Higgsfield oturumu gerekir)</span>
          </summary>
          <div className="px-5 pb-5 border-t border-line pt-4 space-y-5">
          {credits != null && <p className="text-[11px] text-slate-500">Higgsfield kalan kredi: <strong>{credits}</strong></p>}

          {!content.gorsel?.url && !gorselUrl && (
            <div className="card p-3 border-amber-400/40 text-amber-700 text-sm">
              ⚠ AI video için kaynak görsel gerekli. Görsel sekmesinden “Hazır İçerik Ekle” ile bir görsel ekle.{' '}
              <button className="underline" onClick={() => setTab('gorsel')}>Görsel sekmesine git →</button>
            </div>
          )}

          {/* Platform Seçimi */}
          <div>
            <label className="label mb-2">Platform</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {VIDEO_PLATFORMS.map((p) => (
                <button key={p.id}
                  onClick={() => { setVideoPlatform(p.id); setVideoDuration(p.defaultDur); }}
                  className={`border rounded-xl p-3 text-left transition ${
                    videoPlatform === p.id ? 'border-red bg-red/5' : 'border-line hover:border-slate-400'
                  }`}>
                  <div className="text-lg">{p.icon}</div>
                  <div className="text-xs font-semibold mt-1">{p.label}</div>
                  <div className="text-[10px] text-slate-500">{p.ratio} · {p.defaultDur}sn</div>
                </button>
              ))}
            </div>
          </div>

          {/* KALİTE TIER — varsayılan PREMIUM (1080p+). Maliyet farkı görünür. */}
          <div>
            <label className="label mb-2">Kalite tier'ı <span className="font-normal text-slate-500">(çözünürlük + model; maliyet farkı görünür)</span></label>
            <div className="grid grid-cols-3 gap-2">
              {VIDEO_TIER_LIST.map((t) => (
                <button key={t.id} onClick={() => setVideoTier(t.id)}
                  title={`${t.desc} · model: ${t.falModel}/${t.hfModel} · maliyet ${t.costLabel}`}
                  className={`border rounded-xl p-2 text-left transition text-xs ${
                    videoTier === t.id ? 'border-red bg-red/5 font-semibold' : 'border-line hover:border-slate-400'
                  }`}>
                  <div>{t.label}</div>
                  <div className="text-[10px] text-slate-500">{t.resolution} · {t.costLabel}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Seçili: <strong>{VIDEO_TIER_LIST.find((t) => t.id === videoTier)?.label}</strong> ·
              çözünürlük <strong>{VIDEO_TIER_LIST.find((t) => t.id === videoTier)?.resolution}</strong>
              {videoTier === 'premium' ? ' (varsayılan · en yüksek kalite)' : ''}
            </p>
          </div>

          {/* Süre */}
          <div>
            <label className="label mb-1">Süre: <strong>{videoDuration} saniye</strong></label>
            <input type="range" min={10} max={20} step={5} value={videoDuration}
              onChange={(e) => setVideoDuration(Number(e.target.value))}
              className="w-full accent-red" />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>10sn</span><span>15sn</span><span>20sn</span>
            </div>
          </div>

          {/* Dil */}
          <div>
            <label className="label mb-1">Dil <span className="font-normal text-slate-500">(seslendirme bu dilde)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_LANGS.map((l) => (
                <button key={l} onClick={() => setVideoLang(l)}
                  className={`pill ${l === videoLang ? 'pill-active' : 'pill-muted'}`}>
                  {LANG_LABEL[l] || l}
                </button>
              ))}
            </div>
          </div>

          {/* Seslendirme */}
          <div>
            <label className="label mb-1">
              Seslendirme{' '}
              <button onClick={() => setWantVoice((v) => !v)}
                className={`ml-2 pill text-xs ${wantVoice ? 'pill-active' : 'pill-muted'}`}>
                {wantVoice ? '🎙️ Açık' : '🔇 Kapalı'}
              </button>
            </label>
            {wantVoice && (
              <div className="flex flex-wrap gap-2 mt-2">
                {VOICE_STYLES.map((vs) => (
                  <button key={vs.id} onClick={() => setVoiceStyle(vs.id)}
                    className={`border rounded-xl px-3 py-2 text-left text-xs transition ${
                      voiceStyle === vs.id ? 'border-red bg-red/5 font-semibold' : 'border-line hover:border-slate-400'
                    }`}>
                    <div>{vs.label}</div>
                    <div className="text-slate-500 text-[10px]">{vs.desc}</div>
                  </button>
                ))}
              </div>
            )}
            {wantVoice && voiceStyle !== 'maskot' && (
              <div className="text-[11px] text-slate-500 mt-1">
                Higgsfield TTS · {voiceCharLabel[videoLang] || 'Roman'}
              </div>
            )}
          </div>

          <button className="btn btn-ghost text-base px-6 py-3" onClick={handleGenVideo} disabled={videoBusy}>
            {videoBusy
              ? `⏳ Üretiliyor… ${videoElapsed}s (≈3-5 dk)`
              : videoUrl ? '↻ Yeniden üret (kredi)' : '🎬 Video Üret (kredi)'}
          </button>

          {videoUrl && (
            <div>
              <video src={videoUrl} controls className="w-full max-w-xs rounded-xl border border-line bg-black"
                style={{ aspectRatio: videoPlatform === 'youtube' || videoPlatform === 'linkedin' ? '16/9' : '9/16' }} />
              <div className="flex gap-2 mt-2 items-center flex-wrap">
                <a href={videoUrl} download className="btn btn-ghost text-sm">⬇ İndir</a>
                {videoResult?.localPath && <span className="text-xs text-ok">✓ yerel kopya</span>}
                {videoResult?.voice && <span className="text-xs text-slate-500">🎙️ ses var</span>}
                {videoResult?.platform && <span className="text-xs text-slate-500">· {videoResult.platform}</span>}
              </div>
            </div>
          )}

          </div>
        </details>
        </div>
      )}

      {/* ═══ REKLAM ═══ */}
      {tab === 'reklam' && (
        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-head font-bold text-lg">Reklam Metni</h2>
              <p className="text-xs text-slate-500">4 varyant (A-D), özellik odaklı — düzenlenebilir. Meta'ya göndermek için → Kampanyalar</p>
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
              <div className="flex flex-wrap gap-1.5">
                {(draft.languages?.length ? draft.languages : ALL_LANGS).map((l) => (
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

      {/* Varlık Kütüphanesi — her sekmede erişilebilir (libRefresh ile yeniden mount edilir) */}
      <AssetLibrary key={libRefresh} slug={product.slug} />
    </div>
  );
}
