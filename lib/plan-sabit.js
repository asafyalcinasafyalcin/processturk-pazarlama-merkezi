// Dil × kanal matrisi ve zamanlama kuralları — TEK KAYNAK.
// Web Sitesi'ndeki `src/lib/icerik-plan-sabit.ts` ile AYNI kuralı taşır; gönderi
// sayısını/saatini değiştirmenin tek yeri burasıdır (dağınık sabit YOK).

// ⚠️ SOSYALDE TÜRKÇE YOKTUR (Asaf 2026-07-23). Blog sitede 5 dilde yayınlanır,
// kısıt yalnız sosyal kanallar içindir.
export const SOSYAL_DILLER = ['en', 'fr', 'ar', 'ru'];

export const PLATFORMLAR = [
  { id: 'instagram', label: 'Instagram', medya: 'gorsel-veya-video' },
  { id: 'facebook', label: 'Facebook', medya: 'gorsel-veya-video' },
  { id: 'tiktok', label: 'TikTok', medya: 'video' },
  { id: 'youtube', label: 'YouTube', medya: 'video' },
  { id: 'linkedin', label: 'LinkedIn', medya: 'gorsel-veya-video', sayfaSecimi: true },
  { id: 'x', label: 'X', medya: 'gorsel-veya-video' },
];

// LinkedIn'de HANGİ KİMLİKLE yayınlanacağı. Geçilmezse Sosyal Yayın Servisi kendi
// LINKEDIN_PUBLISH_AS varsayılanına düşer — YANLIŞ HESAPTAN YAYIN riski, bu yüzden
// composer bu seçimi her zaman açıkça iletir.
export const LINKEDIN_KIMLIKLER = [
  { id: 'organization', label: 'Şirket sayfası' },
  { id: 'person', label: 'Kişisel profil' },
];

// Aynı güne yığmak hesabı spam gösteriyor → günde sınırlı gönderi, saat aralıklı.
export const GUNDE_MAKS_GONDERI = 4;
export const BASLANGIC_SAATI = 9; // UTC
export const SAAT_ARALIGI = 3;

// i. gönderi için zaman damgası üretir (başlangıç gününden itibaren yayarak).
export function planZamani(baslangic, i) {
  const gun = Math.floor(i / GUNDE_MAKS_GONDERI);
  const saatIndex = i % GUNDE_MAKS_GONDERI;
  const t = new Date(baslangic);
  t.setUTCDate(t.getUTCDate() + gun);
  t.setUTCHours(BASLANGIC_SAATI + saatIndex * SAAT_ARALIGI, 0, 0, 0);
  return t.toISOString();
}
