import { readProducts } from '@/lib/products';
import { readAllContent } from '@/lib/content';
import { configPath } from '@/lib/reklam';
import KampanyalarClient from '@/components/KampanyalarClient';

export const dynamic = 'force-dynamic';

export default async function KampanyalarPage() {
  const products = await readProducts();
  const content = await readAllContent();
  const list = products.map((p) => ({
    slug: p.slug,
    name: p.marketing?.name_tr || p.name_en,
    price: p.price_text,
    languages: p.marketing?.languages || ['tr', 'en'],
    hasVideo: Boolean(content[p.slug]?.video?.url),
    hasCopy: Boolean(content[p.slug]?.copy),
    hasConfig: Boolean(configPath(p.slug)),
  }));

  return (
    <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto">
      <h1 className="font-head font-extrabold text-2xl md:text-3xl mb-1">Reklam Komuta Merkezi</h1>
      <p className="text-slate-400 text-sm mb-6">
        Tek ekrandan: hedefleme → metin → creative → kurulum → rapor. Meta Click-to-WhatsApp.
        Gerçek yayın META token + Asaf onayı gerektirir; hiçbir şey kendiliğinden harcamaz.
      </p>
      <KampanyalarClient products={list} />
    </div>
  );
}
