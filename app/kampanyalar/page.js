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
      <p className="text-slate-400 text-sm mb-4">
        Meta Click-to-WhatsApp kampanyalarını kur. Gerçek yayın için META token + Asaf onayı gerekir — hiçbir şey kendiliğinden harcamaz.
      </p>
      <div className="card p-3 border-navy/20 bg-navy/5 text-sm text-navy mb-6">
        💡 <b>İş akışı:</b> Reklam metinlerini önce ürün sayfasında <b>Kopya</b> sekmesinde üretin, ardından buradan Meta'ya kampanya kurun.
      </div>
      <KampanyalarClient products={list} />
    </div>
  );
}
