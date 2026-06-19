import { readProducts } from '@/lib/products';
import { readAllContent } from '@/lib/content';
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
  }));

  return (
    <div className="px-6 md:px-10 py-8 max-w-4xl mx-auto">
      <h1 className="font-head font-extrabold text-2xl md:text-3xl mb-1">Reklam Kampanyaları</h1>
      <p className="text-slate-400 text-sm mb-6">
        Meta (Facebook/Instagram) Click-to-WhatsApp. Plan üretir (dry-run) — gerçek yayın META token + Asaf onayı gerektirir.
      </p>
      <KampanyalarClient products={list} />
    </div>
  );
}
