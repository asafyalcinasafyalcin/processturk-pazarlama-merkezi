'use client';

import { useEffect, useState } from 'react';

const KANAL_LABEL = {
  site: 'Site (blog)', 'linkedin-sirket': 'LinkedIn şirket', 'linkedin-kisisel': 'LinkedIn kişisel',
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', 'youtube-shorts': 'YouTube Shorts',
};
const DURUM = {
  taslak: { label: 'Taslak', cls: 'pill-muted' },
  onaylandi: { label: 'Onaylı', cls: 'pill-amber' },
  yayinlandi: { label: 'Yayınlandı', cls: 'pill-ok' },
  hata: { label: 'Hata', cls: 'pill-amber' },
  iptal: { label: 'İptal', cls: 'pill-muted' },
};

function tarih(s) {
  try { return new Date(s).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return s; }
}

export default function SiteIcerikAynasi() {
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState('');
  const [kapali, setKapali] = useState(false);
  const [sekme, setSekme] = useState('ogeler');
  const [taban, setTaban] = useState('');

  useEffect(() => {
    fetch('/api/site-icerik')
      .then((r) => r.json())
      .then((d) => {
        setTaban(d.taban || '');
        if (d.kapali) { setKapali(true); setHata(d.error); return; }
        if (!d.ok) { setHata(d.error || 'İçerik alınamadı.'); return; }
        setVeri(d);
      })
      .catch(() => setHata('Sunucuya ulaşılamadı.'));
  }, []);

  if (kapali) {
    return (
      <div className="card p-6 text-sm">
        <div className="font-head font-bold mb-2">Site köprüsü henüz aktif değil</div>
        <p className="text-slate-600 mb-3">{hata}</p>
        <div className="text-slate-500 text-xs space-y-1">
          <div>Aktifleşmesi için iki koşul gerekir:</div>
          <div>1. Her iki tarafta da <b>aynı</b> <code>PAZARLAMA_API_KEY</code> tanımlı olmalı.</div>
          <div>
            2. <code>{taban}</code> sitesinde <code>/api/export/icerik</code> ucu yayında olmalı
            (kod hazır, sitenin bir sonraki deploy'unda devreye girer).
          </div>
        </div>
      </div>
    );
  }
  if (hata) return <div className="card p-6 text-sm text-[color:var(--hata)]">{hata}</div>;
  if (!veri) return <div className="card p-6 text-slate-500 text-sm">Siteden çekiliyor…</div>;

  const { ogeler = [], bloglar = [] } = veri;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button className={`pill ${sekme === 'ogeler' ? 'pill-active' : ''}`} onClick={() => setSekme('ogeler')}>
          Sosyal plan ({ogeler.length})
        </button>
        <button className={`pill ${sekme === 'bloglar' ? 'pill-active' : ''}`} onClick={() => setSekme('bloglar')}>
          Blog yazıları ({bloglar.length})
        </button>
      </div>

      {sekme === 'ogeler' && (
        <div className="space-y-3">
          {ogeler.length === 0 && <div className="card p-8 text-center text-slate-500">Sitede plan öğesi yok.</div>}
          {ogeler.map((o) => {
            const d = DURUM[o.durum] || { label: o.durum, cls: 'pill-muted' };
            return (
              <div key={o.id} className="card p-4 flex items-start gap-3">
                {o.gorselUrl
                  ? <img src={`${taban}${o.gorselUrl}`} alt="" loading="lazy" className="w-16 h-16 rounded object-cover border border-line shrink-0" />
                  : <div className="w-16 h-16 rounded border border-line bg-slate-100 grid place-items-center text-slate-300 text-xs shrink-0">—</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="pill pill-muted">{KANAL_LABEL[o.kanal] || o.kanal}</span>
                    <span className={`pill ${d.cls}`}>{d.label}</span>
                    <span className="text-xs text-slate-500">{o.dil?.toUpperCase()} · {tarih(o.planlananZaman)}</span>
                    {o.videoUrl && <span className="text-[10px] text-red">🎬 video</span>}
                  </div>
                  {o.baslik && <div className="font-head font-bold text-sm mb-0.5">{o.baslik}</div>}
                  <p className="text-sm text-slate-600 line-clamp-2">{o.metin || '(metin yok)'}</p>
                  {o.permalink && (
                    <a href={o.permalink} target="_blank" rel="noreferrer" className="text-[11px] text-red hover:underline">
                      yayınlanan gönderiyi aç →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sekme === 'bloglar' && (
        <div className="space-y-3">
          {bloglar.length === 0 && <div className="card p-8 text-center text-slate-500">Sitede yayınlanmış blog yok.</div>}
          {bloglar.map((b) => (
            <div key={b.id} className="card p-4 flex items-start gap-3">
              {b.cover
                ? <img src={b.cover.startsWith('http') ? b.cover : `${taban}${b.cover}`} alt="" loading="lazy" className="w-16 h-16 rounded object-cover border border-line shrink-0" />
                : <div className="w-16 h-16 rounded border border-line bg-slate-100 grid place-items-center text-slate-300 text-xs shrink-0">—</div>}
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-500 mb-1">{tarih(b.date)}</div>
                <div className="font-head font-bold text-sm mb-0.5">{b.title?.tr || b.title?.en || b.slug}</div>
                <p className="text-sm text-slate-600 line-clamp-2">{b.excerpt?.tr || b.excerpt?.en || ''}</p>
                <a href={`${taban}/tr/blog/${b.slug}`} target="_blank" rel="noreferrer" className="text-[11px] text-red hover:underline">
                  sitede aç →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
