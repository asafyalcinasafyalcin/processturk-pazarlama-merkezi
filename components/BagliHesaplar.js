'use client';

import { useEffect, useState } from 'react';

const PLATFORM_META = {
  instagram: { label: 'Instagram', icon: '📸' },
  facebook: { label: 'Facebook', icon: '📘' },
  tiktok: { label: 'TikTok', icon: '🎵' },
  youtube: { label: 'YouTube', icon: '▶️' },
  linkedin: { label: 'LinkedIn (şirket + kişisel)', icon: '💼' },
  x: { label: 'X', icon: '✕' },
};
const SIRA = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x'];

export default function BagliHesaplar() {
  const [hesaplar, setHesaplar] = useState(null);
  const [hata, setHata] = useState('');

  useEffect(() => {
    fetch('/api/accounts/status')
      .then((r) => r.json())
      .then((d) => (d.ok ? setHesaplar(d.hesaplar) : setHata(d.error || 'Durum alınamadı.')))
      .catch(() => setHata('Sunucuya ulaşılamadı.'));
  }, []);

  if (hata) return <div className="card p-6 text-sm text-[color:var(--hata)]">{hata}</div>;
  if (!hesaplar) return <div className="card p-6 text-slate-500 text-sm">Yükleniyor…</div>;

  return (
    <div className="space-y-3">
      {SIRA.map((p) => {
        const h = hesaplar[p];
        const meta = PLATFORM_META[p];
        return (
          <div key={p} className="card p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{meta.icon}</span>
              <div>
                <div className="font-head font-bold text-sm">{meta.label}</div>
                <div className="text-xs text-slate-500">{h.yontem}</div>
              </div>
            </div>
            <span className={`pill ${h.configured ? 'pill-ok' : 'pill-amber'}`}>
              {h.configured ? '✓ Yapılandırılmış' : '⚠ Kimlik eksik'}
            </span>
          </div>
        );
      })}
      <div className="text-xs text-slate-400 pt-2">
        Kimlik ekleme/yenileme (TikTok/YouTube OAuth token'ları dahil) merkezi sır dosyasından
        dağıtılır — <code>Temel_Sistemler/sirlari-dagit.mjs</code>. Buradan doğrudan bağlanma/
        yenileme henüz yok (sonraki tur).
      </div>
    </div>
  );
}
