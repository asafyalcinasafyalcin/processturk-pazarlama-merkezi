import SiteIcerikAynasi from '@/components/SiteIcerikAynasi';

export const dynamic = 'force-dynamic';

export default function SiteIcerikPage() {
  return (
    <div className="px-4 md:px-10 py-8 max-w-5xl mx-auto">
      <h1 className="font-head font-extrabold text-2xl md:text-3xl mb-1">Sitedeki İçerik</h1>
      <p className="text-slate-500 text-sm mb-6">
        processturk.com'da üretilen blog yazıları ve sosyal plan öğeleri — <b>canlı ayna</b>,
        salt-okunur. Buradan değiştirilmez; tek kaynak sitenin İçerik Stüdyosu'dur.
      </p>
      <SiteIcerikAynasi />
    </div>
  );
}
