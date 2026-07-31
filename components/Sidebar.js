'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

// Görev akışına göre gruplu nav (Web Sitesi admin'indeki ADMIN_NAV deseni).
// `short` mobil alt tab bar'da kullanılır; oraya yalnız `mobil:true` olanlar çıkar
// (7+ sekme 375px'te okunamaz hâle geliyordu).
const NAV = [
  { grup: 'Üretim', items: [
    { href: '/', label: 'Ürünler', short: 'Ürünler', icon: '📦', mobil: true },
    { href: '/olustur', label: 'İçerik Oluştur', short: 'Oluştur', icon: '✏️', mobil: true },
    { href: '/arsiv', label: 'Varlık Arşivi', short: 'Arşiv', icon: '🗂️' },
  ] },
  { grup: 'Yayın', items: [
    { href: '/takvim', label: 'İçerik Takvimi', short: 'Takvim', icon: '🗓️', mobil: true },
    { href: '/kampanyalar', label: 'Reklam Kampanyaları', short: 'Reklam', icon: '🚀' },
    { href: '/hesaplar', label: 'Bağlı Hesaplar', short: 'Hesaplar', icon: '🔗', mobil: true },
  ] },
  { grup: 'Site', items: [
    { href: '/site-icerik', label: 'Sitedeki İçerik', short: 'Site', icon: '🌐', mobil: true },
    { href: '/ayarlar', label: 'Ayarlar', short: 'Ayarlar', icon: '⚙️' },
  ] },
];
const TUM_ITEMS = NAV.flatMap((g) => g.items);
const MOBIL_ITEMS = TUM_ITEMS.filter((i) => i.mobil);

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
  const router = useRouter();
  const isActive = (href) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  async function cikisYap() {
    await fetch('/api/auth/login', { method: 'DELETE' });
    router.push('/giris');
    router.refresh();
  }
  return (
    <>
      {/* ── Masaüstü sol nav ── */}
      <aside className="w-64 shrink-0 border-r border-line bg-white px-4 py-6 hidden md:flex md:flex-col">
        <Link href="/" className="flex items-center gap-2 px-2 mb-8">
          <BrandBadge logoInitial={logoInitial} brandName={brandName} panelSubtitle={panelSubtitle} />
        </Link>

        <nav className="flex flex-col gap-4">
          {NAV.map((g) => (
            <div key={g.grup}>
              <div className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{g.grup}</div>
              <div className="flex flex-col gap-1">
                {g.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? 'bg-red/10 text-navy border border-red/40 font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <span className="flex items-center gap-2.5"><span>{item.icon}</span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-6 text-[11px] text-slate-500 leading-relaxed">
          <a href="http://127.0.0.1:4170" className="hover:text-red">← Ana Panel (Hub)</a>
          <div className="mt-2">Port 4181 · v2</div>
          <button onClick={cikisYap} className="mt-3 text-slate-500 hover:text-red">Çıkış yap</button>
        </div>
      </aside>

      {/* ── Mobil üst marka çubuğu (375px) ── */}
      <header className="md:hidden sticky top-0 z-40 flex items-center gap-2 border-b border-line bg-white/95 backdrop-blur px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <BrandBadge logoInitial={logoInitial} brandName={brandName} panelSubtitle={panelSubtitle} />
        </Link>
      </header>

      {/* ── Mobil alt tab bar (erişilebilir nav, 375px) ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-line bg-white/95 backdrop-blur">
        {MOBIL_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] ${active ? 'text-red font-semibold' : 'text-slate-500'}`}
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
