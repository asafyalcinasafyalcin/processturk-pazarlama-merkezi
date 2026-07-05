import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findProduct } from '@/lib/products';
import { getContent } from '@/lib/content';
import { syncReklamCreatives } from '@/lib/reklam-sync';
import UrunDetay from '@/components/UrunDetay';

export const dynamic = 'force-dynamic';

export default async function UrunPage({ params }) {
  const { slug } = await params;
  const product = await findProduct(slug);
  if (!product) notFound();
  // Reklam kampanyasında üretilen creative'leri otomatik kütüphaneye + (boşsa) ana görsele bağla.
  // İdempotent/deduped — sayfa açılışında yalnız yeni dosyaları çeker.
  await syncReklamCreatives(slug).catch((e) => console.warn('[reklam-sync]', e?.message));
  const content = await getContent(slug);

  return (
    <div className="px-4 md:px-10 py-8 max-w-5xl mx-auto">
      <Link href="/" className="text-sm text-slate-500 hover:text-red">← Ürünler</Link>
      <UrunDetay product={product} initialContent={content} />
    </div>
  );
}
