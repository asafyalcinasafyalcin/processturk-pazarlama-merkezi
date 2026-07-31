import BagliHesaplar from '@/components/BagliHesaplar';

export const dynamic = 'force-dynamic';

export default function HesaplarPage() {
  return (
    <div className="px-4 md:px-10 py-8 max-w-3xl mx-auto">
      <h1 className="font-head font-extrabold text-2xl md:text-3xl mb-1">Bağlı Hesaplar</h1>
      <p className="text-slate-500 text-sm mb-6">
        Takvim'den yayın yapılabilecek platformlar ve bağlantı durumları. "Yapılandırılmış"
        yalnızca kimlik bilgisinin ortam değişkeninde dolu olduğunu gösterir — geçerliliği ilk
        gerçek yayın denemesinde kanıtlanır.
      </p>
      <BagliHesaplar />
    </div>
  );
}
