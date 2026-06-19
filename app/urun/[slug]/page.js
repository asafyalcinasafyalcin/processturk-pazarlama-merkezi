import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findProduct } from '@/lib/products';
import { getContent } from '@/lib/content';
import UrunDetay from '@/components/UrunDetay';

export const dynamic = 'force-dynamic';

export default async function UrunPage({ params }) {
  const { slug } = await params;
  const product = await findProduct(slug);
  if (!product) notFound();
  const content = await getContent(slug);

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto">
      <Link href="/" className="text-sm text-slate-500 hover:text-red">← Ürünler</Link>
      <UrunDetay product={product} initialContent={content} />
    </div>
  );
}
