'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Ürünler', short: 'Ürünler', icon: '📦', ready: true },
  { href: '/arsiv', label: 'Arşiv', short: 'Arşiv', icon: '🗂️', ready: true },
  { href: '/takvim', label: 'İçerik Takvimi', short: 'Takvim', icon: '🗓️', ready: true },
  { href: '/kampanyalar', label: 'Kampanyalar', short: 'Kampanya', icon: '🚀', ready: true },
  { href: '/ayarlar', label: 'Ayarlar', short: 'Ayarlar', icon: '⚙️', ready: true },
];

// Marka adı/logo layout'tan prop olarak gelir (brand server-only; client fs kullanamaz).
// brandName/logoInitial/panelSubtitle set değilse ProcessTürk varsayılanına düşer.
function BrandBadge({ logoInitial, brandName, panelSubtitle }) {
  return (
    <>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red text-white font-head font-extrabold">{logoInitial}</span>
      <div className="leading-tight">
        <div className="font-head font-extrabold text-sm tracking-wide text-navy">{brandName}</div>
        <div className="text-[11px] text-slate-500">{panelSubtitle}</div>
      </div>
    </>
  );
}

// Marka bilgisi layout'tan prop olarak gelir (brand.js server-only). Layout her zaman
// BRAND.* geçirir; aşağıdaki nötr default'lar yalnız prop'suz çağrıya karşı emniyettir.
export default function Sidebar({ brandName = 'Pazarlama Merkezi', logoInitial = '•', panelSubtitle = 'Pazarlama Merkezi' } = {}) {
  const pathname = usePathname();
  const isActive = (href) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <>
      {/* ── Masaüstü sol nav ── */}
      <aside className="w-64 shrink-0 border-r border-[#e6eaf1] bg-white px-4 py-6 hidden md:flex md:flex-col">
        <Link href="/" className="flex items-center gap-2 px-2 mb-8">
          <BrandBadge logoInitial={logoInitial} brandName={brandName} panelSubtitle={panelSubtitle} />
        </Link>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const base = 'flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors';
            if (!item.ready) {
              return (
                <div key={item.href} className={`${base} text-slate-500 cursor-not-allowed`} title="Yakında">
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

        <div className="mt-auto pt-6 text-[11px] text-slate-500 leading-relaxed">
          <a href="http://127.0.0.1:4170" className="hover:text-red">← Ana Panel (Hub)</a>
          <div className="mt-2">Port 4181 · v2</div>
        </div>
      </aside>

      {/* ── Mobil üst marka çubuğu (375px) ── */}
      <header className="md:hidden sticky top-0 z-40 flex items-center gap-2 border-b border-[#e6eaf1] bg-white/95 backdrop-blur px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <BrandBadge logoInitial={logoInitial} brandName={brandName} panelSubtitle={panelSubtitle} />
        </Link>
      </header>

      {/* ── Mobil alt tab bar (erişilebilir nav, 375px) ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-[#e6eaf1] bg-white/95 backdrop-blur">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.ready ? item.href : '#'}
              aria-disabled={!item.ready}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] ${active ? 'text-red font-semibold' : 'text-slate-500'} ${!item.ready ? 'opacity-40 pointer-events-none' : ''}`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="truncate max-w-full px-0.5">{item.short}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
