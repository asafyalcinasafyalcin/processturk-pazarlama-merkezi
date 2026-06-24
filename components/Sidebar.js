'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Ürünler', icon: '📦', ready: true },
  { href: '/arsiv', label: 'Arşiv', icon: '🗂️', ready: true },
  { href: '/takvim', label: 'İçerik Takvimi', icon: '🗓️', ready: true },
  { href: '/kampanyalar', label: 'Kampanyalar', icon: '🚀', ready: true },
  { href: '/ayarlar', label: 'Ayarlar', icon: '⚙️', ready: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 shrink-0 border-r border-[#e6eaf1] bg-white px-4 py-6 hidden md:flex md:flex-col">
      <Link href="/" className="flex items-center gap-2 px-2 mb-8">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red text-white font-head font-extrabold">P</span>
        <div className="leading-tight">
          <div className="font-head font-extrabold text-sm tracking-wide text-navy">ProcessTürk</div>
          <div className="text-[11px] text-slate-500">Pazarlama Merkezi</div>
        </div>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const base = 'flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors';
          if (!item.ready) {
            return (
              <div key={item.href} className={`${base} text-slate-400 cursor-not-allowed`} title="Yakında">
                <span className="flex items-center gap-2.5"><span>{item.icon}</span>{item.label}</span>
                <span className="text-[10px] pill pill-muted">yakında</span>
              </div>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${base} ${active ? 'bg-red/10 text-navy border border-red/40 font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="flex items-center gap-2.5"><span>{item.icon}</span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 text-[11px] text-slate-400 leading-relaxed">
        <a href="http://127.0.0.1:4170" className="hover:text-red">← Ana Panel (Hub)</a>
        <div className="mt-2">Port 4181 · v2</div>
      </div>
    </aside>
  );
}
