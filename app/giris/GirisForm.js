'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function GirisForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [sifre, setSifre] = useState('');
  const [hata, setHata] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setHata('');
    setGonderiliyor(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: sifre }),
      });
      const data = await res.json();
      if (!data.ok) {
        setHata(data.error || 'Giriş başarısız.');
        setGonderiliyor(false);
        return;
      }
      router.push(params.get('sonra') || '/');
      router.refresh();
    } catch {
      setHata('Sunucuya ulaşılamadı.');
      setGonderiliyor(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-8 w-full max-w-sm">
      <h1 className="font-head font-extrabold text-xl text-center mb-1">Pazarlama Komuta Merkezi</h1>
      <p className="text-slate-500 text-sm text-center mb-6">Devam etmek için şifreyi girin.</p>
      <label className="label">Şifre</label>
      <input
        type="password"
        className="input mb-3"
        value={sifre}
        onChange={(e) => setSifre(e.target.value)}
        autoFocus
        required
      />
      {hata && <div className="text-sm text-[color:var(--hata)] mb-3">{hata}</div>}
      <button className="btn btn-primary w-full" disabled={gonderiliyor}>
        {gonderiliyor ? '…' : 'Giriş Yap'}
      </button>
    </form>
  );
}
