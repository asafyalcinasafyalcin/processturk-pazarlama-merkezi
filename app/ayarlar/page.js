import { readSettings } from '@/lib/settings';
import AyarlarClient from '@/components/AyarlarClient';

export const dynamic = 'force-dynamic';

export default async function AyarlarPage() {
  const settings = await readSettings();
  return (
    <div className="px-4 md:px-10 py-8 max-w-3xl mx-auto">
      <h1 className="font-head font-extrabold text-2xl md:text-3xl mb-1">Ayarlar</h1>
      <p className="text-slate-500 text-sm mb-6">Marka sesi ve telaffuz sözlüğü — tüm videolar bunu kullanır.</p>
      <AyarlarClient initial={settings} />
    </div>
  );
}
