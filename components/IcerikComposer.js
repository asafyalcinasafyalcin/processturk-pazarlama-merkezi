'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PLATFORMLAR, SOSYAL_DILLER, LINKEDIN_KIMLIKLER } from '@/lib/plan-sabit';

const DIL_LABEL = { en: 'İngilizce', fr: 'Fransızca', ar: 'Arapça', ru: 'Rusça', tr: 'Türkçe' };
const TUM_DILLER = [...SOSYAL_DILLER, 'tr'];

function PillToggle({ secili, onClick, children, uyari }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={uyari || undefined}
      className={`pill ${secili ? 'pill-active' : ''} cursor-pointer`}
    >
      {children}
    </button>
  );
}

export default function IcerikComposer() {
  const router = useRouter();
  const [tema, setTema] = useState('');
  const [platformlar, setPlatformlar] = useState(new Set(['instagram']));
  const [diller, setDiller] = useState(new Set(['en']));
  const [liKimlikler, setLiKimlikler] = useState(new Set(['organization']));
  const [icerikler, setIcerikler] = useState({}); // { [dil]: {caption, imageUrl, videoUrl} }
  const [baslangic, setBaslangic] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [sonuc, setSonuc] = useState(null);
  const [hata, setHata] = useState('');

  function toggle(set, setter, id) {
    const n = new Set(set);
    if (n.has(id)) n.delete(id); else n.add(id);
    setter(n);
  }

  function icerikGuncelle(dil, alan, deger) {
    setIcerikler((s) => ({ ...s, [dil]: { ...(s[dil] || {}), [alan]: deger } }));
  }

  // LinkedIn'de seçilen her kimlik ayrı gönderidir → sayaç onu da hesaba katar.
  const linkedinSecili = platformlar.has('linkedin');
  const liCarpan = linkedinSecili ? Math.max(1, liKimlikler.size) : 0;
  const adet = diller.size * ((platformlar.size - (linkedinSecili ? 1 : 0)) + liCarpan);
  // TikTok ve YouTube YALNIZ video kabul eder — dilinde video yoksa yayın anında
  // "assisted"a düşer. Kullanıcıyı gönderi oluşmadan ÖNCE uyar.
  const videoZorunluSecili = [...platformlar].some((p) => PLATFORMLAR.find((x) => x.id === p)?.medya === 'video');
  const videosuzDiller = [...diller].filter((d) => !icerikler[d]?.videoUrl);
  const videoUyarisi = videoZorunluSecili && videosuzDiller.length > 0;

  async function submit(e) {
    e.preventDefault();
    setHata(''); setSonuc(null); setGonderiliyor(true);
    try {
      const res = await fetch('/api/content-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tema,
          platformlar: [...platformlar],
          diller: [...diller],
          linkedinKimlikler: [...liKimlikler],
          medya: [...diller].map((d) => ({ lang: d, ...(icerikler[d] || {}) })),
          baslangic: baslangic ? new Date(baslangic).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) { setHata(data.error); setGonderiliyor(false); return; }
      setSonuc(data.adet);
      setGonderiliyor(false);
    } catch (err) {
      setHata(err.message); setGonderiliyor(false);
    }
  }

  if (sonuc) {
    return (
      <div className="card p-8 text-center">
        <div className="text-3xl mb-2">✓</div>
        <h2 className="font-head font-bold text-lg mb-1">{sonuc} taslak oluşturuldu</h2>
        <p className="text-slate-500 text-sm mb-5">
          Hepsi <b>Taslak</b> durumunda — İçerik Takvimi'nden onaylayıp yayınlayabilirsin.
        </p>
        <div className="flex gap-2 justify-center">
          <button className="btn btn-primary" onClick={() => router.push('/takvim')}>Takvime Git</button>
          <button className="btn btn-ghost" onClick={() => { setSonuc(null); setTema(''); setIcerikler({}); }}>
            Yeni kampanya
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="card p-5">
        <label className="label">Kampanya adı</label>
        <input className="input" value={tema} onChange={(e) => setTema(e.target.value)}
          placeholder="örn. Salça Hattı Tanıtımı" required />
      </div>

      <div className="card p-5">
        <label className="label">Platformlar</label>
        <div className="flex gap-2 flex-wrap">
          {PLATFORMLAR.map((p) => (
            <PillToggle key={p.id} secili={platformlar.has(p.id)}
              onClick={() => toggle(platformlar, setPlatformlar, p.id)}
              uyari={p.medya === 'video' ? 'Yalnız video kabul eder' : undefined}>
              {p.label}{p.medya === 'video' ? ' 🎬' : ''}
            </PillToggle>
          ))}
        </div>
      </div>

      {linkedinSecili && (
        <div className="card p-5">
          <label className="label">LinkedIn — hangi sayfada paylaşılsın?</label>
          <div className="flex gap-2 flex-wrap">
            {LINKEDIN_KIMLIKLER.map((k) => (
              <PillToggle key={k.id} secili={liKimlikler.has(k.id)}
                onClick={() => toggle(liKimlikler, setLiKimlikler, k.id)}>
                {k.label}
              </PillToggle>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            İkisi de seçilirse her dil için iki ayrı gönderi oluşur. Seçim yapılmazsa şirket
            sayfası kullanılır.
          </p>
        </div>
      )}

      <div className="card p-5">
        <label className="label">Diller</label>
        <div className="flex gap-2 flex-wrap mb-2">
          {TUM_DILLER.map((d) => (
            <PillToggle key={d} secili={diller.has(d)} onClick={() => toggle(diller, setDiller, d)}>
              {DIL_LABEL[d]}
            </PillToggle>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">
          Sosyal kanallarda Türkçe kullanılmıyor (Asaf kararı) — yalnız blog/site içeriği için seç.
        </p>
      </div>

      {[...diller].map((d) => (
        <div key={d} className="card p-5">
          <div className="font-head font-bold text-sm mb-3">{DIL_LABEL[d]} içeriği</div>
          <label className="label">Metin / açıklama</label>
          <textarea className="textarea mb-3" rows={4}
            value={icerikler[d]?.caption || ''}
            onChange={(e) => icerikGuncelle(d, 'caption', e.target.value)} />
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Video URL (TikTok/YouTube için zorunlu)</label>
              <input className="input" value={icerikler[d]?.videoUrl || ''}
                onChange={(e) => icerikGuncelle(d, 'videoUrl', e.target.value)}
                placeholder="https://processturk.com/…/reel.mp4" />
            </div>
            <div>
              <label className="label">Görsel URL</label>
              <input className="input" value={icerikler[d]?.imageUrl || ''}
                onChange={(e) => icerikGuncelle(d, 'imageUrl', e.target.value)}
                placeholder="https://…" />
            </div>
          </div>
        </div>
      ))}

      <div className="card p-5">
        <label className="label">Başlangıç tarihi (boşsa yarın)</label>
        <input type="date" className="input max-w-xs" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} />
        <p className="text-[11px] text-slate-400 mt-2">
          Gönderiler günde en fazla 4 tane, 3 saat arayla yayılır — aynı güne yığılmaz.
        </p>
      </div>

      {videoUyarisi && (
        <div className="card p-4 text-sm" style={{ borderColor: 'var(--uyari)' }}>
          ⚠ TikTok/YouTube seçili ama şu dillerde video URL'si yok: <b>{videosuzDiller.map((d) => DIL_LABEL[d]).join(', ')}</b>.
          Video olmadan bu kanallar yayın anında "elle yükle" paketine düşer.
        </div>
      )}

      {hata && <div className="card p-4 text-sm text-[color:var(--hata)]">{hata}</div>}

      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={gonderiliyor || adet === 0}>
          {gonderiliyor ? '…' : `${adet} taslak oluştur`}
        </button>
        <span className="text-xs text-slate-500">
          {platformlar.size} platform × {diller.size} dil
        </span>
      </div>
    </form>
  );
}
