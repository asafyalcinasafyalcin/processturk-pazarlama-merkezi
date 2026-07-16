// KURUMSAL GÖRSEL DNA — reklam görselleri, ProcessTürk web sitesi ürün galerisi ve blog
// kapaklarıyla TEK görsel dilde okunsun diye her reklam görseli prompt'una eklenen kuyruk.
//
// KAYNAK (tek görsel dil): Processturk_Web_Sitesi/src/lib/gorsel-prompt.ts
//   → KURUMSAL_TON / GORSEL_TABAN / NEGATIFLER sabitleri.
// Web sitesi ayrı bir repo/deploy olduğu için burası onun AYNASIDIR; biri değişince
// diğeri elle eşitlenir (ikisi de TASARIM_SISTEMI.md §8'e dayanır).
//
// NOT — "no people": reklam template'lerinden biri (satış mühendisi) KASITLI olarak insan
// içerir. Bu yüzden kurumsal kuyruk "no people"ı GLOBAL zorlamaz; insan negatifi template'in
// kendi buildNegativePrompt'una bırakılır. Kuyruk yalnız TON + fotoğrafik kalite + marka
// negatifi (markalama post-prodüksiyon overlay'idir, AI yazıyı bozar) ekler.

export const KURUMSAL_TON =
  "deep navy blue and steel corporate tones, premium B2B engineering style, no oversaturated colors";
export const GORSEL_TABAN =
  "photorealistic professional photography, natural professional lighting, high detail, commercial advertising quality";
// Her reklam görselinde geçerli marka-negatifi (yazı/logo = overlay). İnsan/makine-form
// negatifi buraya KONMAZ (template'e özel).
export const MARKA_NEGATIF = "no text, no logo, no watermark, no readable digits in the image";

/** Reklam görseli prompt'unun sonuna eklenen kurumsal kuyruk (tek görsel dil). */
export function kurumsalKuyruk() {
  return [KURUMSAL_TON, GORSEL_TABAN, MARKA_NEGATIF].join(", ");
}
