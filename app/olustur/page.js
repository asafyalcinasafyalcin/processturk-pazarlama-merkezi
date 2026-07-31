import IcerikComposer from '@/components/IcerikComposer';

export const dynamic = 'force-dynamic';

export default function OlusturPage() {
  return (
    <div className="px-4 md:px-10 py-8 max-w-3xl mx-auto">
      <h1 className="font-head font-extrabold text-2xl md:text-3xl mb-1">İçerik Kampanyası Oluştur</h1>
      <p className="text-slate-500 text-sm mb-6">
        Bir tema seç, platform ve dilleri işaretle — hepsi tek seferde takvime <b>taslak</b> olarak
        düşer. Ürüne bağlı olmak zorunda değil (hat videosu, kurumsal film, duyuru…).
        Onaysız hiçbir şey yayınlanmaz.
      </p>
      <IcerikComposer />
    </div>
  );
}
