// Medya URL yardımcısı — TEK KAYNAK. Küçük resim/önizleme gösteren her bileşen
// (TakvimClient, ArsivClient, AssetLibrary) buradan geçer.
//
// ── NEDEN VAR ──
// 1) ÖNBELLEK SÜRÜMÜ: pazarlama.processturk.com Cloudflare arkasında (Free plan).
//    /api/media 2026-07-19'a kadar Range isteklerini desteklemiyordu; Cloudflare o
//    dönemin yanıtlarını `max-age=86400` ile önbelleğe aldı. Sunucu düzeltildikten
//    sonra bile Cloudflare 24 saat boyunca ESKİ yanıtı (200, Accept-Ranges yok)
//    servis etmeye devam etti → tarayıcı seek yapamadı → önizlemeler boş kaldı.
//    Free planda API ile "prefix purge" yok ve eldeki token'da purge yetkisi yok.
//    Çözüm: URL'e sürüm parametresi ekleyerek önbellekte KARŞILIĞI OLMAYAN bir
//    adres üretmek. Doğrulandı: ?v=2 ile Cloudflare MISS + sunucudan 206 geliyor.
//
//    ⚠️ Medyanın sunulma biçimi (başlıklar, Range davranışı) ileride yine değişirse
//    MEDYA_SURUM'u artır — Cloudflare'i beklemeden anında yeni yanıt alınır.
//
// 2) İLK KARE: <video> etiketinde poster yoksa tarayıcı boş/siyah kutu çizer.
//    `#t=0.1` ile 0,1. saniyeye konumlanır ve o kare çizilir. Bu ANCAK sunucu
//    Range (206) desteklerse çalışır — iki düzeltme birbirine bağlıdır.
//    Fragment (#) sunucuya gönderilmez, bu yüzden önbelleği KIRMAZ; sürüm
//    parametresi bu yüzden ayrıca gereklidir.

export const MEDYA_SURUM = "2";

/**
 * @param {string} url  /api/media/... adresi (boş olabilir)
 * @param {{kare?: boolean}} secenek  kare:true → video ilk karesini çizdir
 * @returns {string} sürümlenmiş (ve istenirse kareye konumlanmış) URL
 */
export function medyaUrl(url, { kare = false } = {}) {
  if (!url) return url;
  // Zaten sürümlenmişse tekrar ekleme (çift parametre önbelleği ikiye böler).
  if (url.includes(`v=${MEDYA_SURUM}`)) return url;
  const ayirac = url.includes("?") ? "&" : "?";
  // Sıra önemli: sorgu (?) fragment'ten (#) ÖNCE gelmeli, aksi halde parametre
  // fragment'in parçası sayılır ve sunucuya hiç ulaşmaz.
  const [taban, parca] = url.split("#");
  const yeni = `${taban}${ayirac}v=${MEDYA_SURUM}`;
  if (kare) return `${yeni}#t=0.1`;
  return parca ? `${yeni}#${parca}` : yeni;
}
