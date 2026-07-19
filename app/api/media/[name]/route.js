import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { APP_ROOT, dataDir } from '@/lib/paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
};

// Render edilen + yüklenen/içe aktarılan medya dosyalarını sun.
// Arama sırası: 1) public/renders (build'e baked-in)  2) data/renders  3) data/uploads
// (ikisi de VPS'te kalıcı mount — media-store.js buraya yazar).
export async function GET(request, { params }) {
  const { name } = await params;
  // güvenlik: yalnızca dosya adı, dizin geçişi yok
  const safe = path.basename(name || '');
  const ext = path.extname(safe).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return new Response('Not found', { status: 404 });

  // Arama sırası: 1) public/renders  2) data/renders  3) data/uploads
  const candidates = [
    path.join(APP_ROOT, 'public', 'renders', safe),
    path.join(dataDir(), 'renders', safe),
    path.join(dataDir(), 'uploads', safe),
  ];
  const file = candidates.find(existsSync);
  if (!file) return new Response('Not found', { status: 404 });

  const size = statSync(file).size;

  // ── RANGE DESTEĞİ (206) ──
  // Bu uç eskiden her zaman 200 + tüm dosya dönüyordu ve `Accept-Ranges` yoktu.
  // Sonuç: tarayıcı videoda SEEK YAPAMIYORDU. Bu yüzden küçük resimlerdeki
  // `#t=0.1` çalışmıyor, ilk kare çizilmiyor ve önizleme boş/siyah kutu kalıyordu.
  // (Ayrıca uzun videoda ileri sarma da çalışmaz.) Range gelirse 206 döndürülür.
  const aralik = request.headers.get('range');
  if (aralik) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(aralik.trim());
    if (m) {
      let bas = m[1] === '' ? null : Number(m[1]);
      let son = m[2] === '' ? null : Number(m[2]);
      // "bytes=-N" → son N bayt
      if (bas === null && son !== null) { bas = Math.max(0, size - son); son = size - 1; }
      else if (bas !== null && son === null) { son = size - 1; }
      if (bas === null || Number.isNaN(bas) || Number.isNaN(son) || bas > son || bas >= size) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: { 'Content-Range': `bytes */${size}` },
        });
      }
      son = Math.min(son, size - 1);
      return new Response(createReadStream(file, { start: bas, end: son }), {
        status: 206,
        headers: {
          'Content-Type': mime,
          'Content-Length': String(son - bas + 1),
          'Content-Range': `bytes ${bas}-${son}/${size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }
  }

  return new Response(createReadStream(file), {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(size),
      // Tarayıcıya "bu dosyada seek yapabilirsin" der; olmadan video kontrolleri kısıtlı kalır.
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
