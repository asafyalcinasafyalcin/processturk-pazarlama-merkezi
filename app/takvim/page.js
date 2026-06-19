import { readCalendar } from '@/lib/calendar';
import { readProducts } from '@/lib/products';
import TakvimClient from '@/components/TakvimClient';

export const dynamic = 'force-dynamic';

export default async function TakvimPage() {
  const cal = await readCalendar();
  const products = await readProducts();
  const names = {};
  for (const p of products) names[p.slug] = p.marketing?.name_tr || p.name_en;

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto">
      <h1 className="font-head font-extrabold text-2xl md:text-3xl mb-1">İçerik Takvimi</h1>
      <p className="text-slate-400 text-sm mb-6">Taslak → Onay → Yayın. Onaysız hiçbir gönderim yapılamaz.</p>
      <TakvimClient initialItems={cal.items} names={names} />
    </div>
  );
}
