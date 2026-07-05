'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Web sitesi kataloğunu elle eşitleme butonu. Sonucu kısa bir satırla gösterir.
export default function WebsiteSyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function run() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/website-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (data.ok) {
        const parts = [];
        if (data.added?.length) parts.push(`${data.added.length} yeni`);
        if (data.imagesDownloaded) parts.push(`${data.imagesDownloaded} görsel`);
        if (data.pendingImages) parts.push(`${data.pendingImages} görsel sırada`);
        setMsg(parts.length ? `Eşitlendi: ${parts.join(', ')}` : 'Eşitlendi — katalog güncel');
        router.refresh();
      } else {
        setMsg(data.error || 'Eşitleme başarısız');
      }
    } catch (err) {
      setMsg('Hata: ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={run} disabled={busy} className="btn btn-ghost text-sm" title="Web sitesi kataloğunu şimdi eşitle">
        {busy ? 'Eşitleniyor…' : '🌐 Siteyle Eşitle'}
      </button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </span>
  );
}
