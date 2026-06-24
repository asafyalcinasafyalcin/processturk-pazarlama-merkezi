// CDN URL'lerini servis-edilen yerel medya deposuna indirir.
// CDN URL'leri expire olur; yerel kopya kalıcıdır VE /api/media ile canlıda sunulur
// (public/ çalışma-zamanı yazımı next start'ta sunulmaz — bkz. lib/media-store.js).
import { saveFromUrl } from './media-store.js';

/**
 * URL'i medya deposuna indir; servis edilebilir yol döndür.
 * @returns { localPath: '/api/media/...', absPath: '/absolute/...' }  (başarısızsa null'lar)
 */
export async function downloadAndSave(url, slug, type) {
  if (!url) throw new Error('downloadAndSave: url boş');
  try {
    const { servedUrl, absPath } = await saveFromUrl(url, { slug, type });
    return { localPath: servedUrl, absPath };
  } catch (e) {
    // İndirme başarısız olursa sessizce atla (CDN URL hâlâ content.json'da kalır)
    console.warn('[download-asset] indirme başarısız, CDN URL kullanılacak:', e.message.slice(0, 120));
    return { localPath: null, absPath: null };
  }
}
