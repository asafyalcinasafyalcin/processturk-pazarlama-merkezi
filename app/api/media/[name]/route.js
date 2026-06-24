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
  const stream = createReadStream(file);
  return new Response(stream, {
    headers: { 'Content-Type': mime, 'Content-Length': String(size), 'Cache-Control': 'public, max-age=86400' },
  });
}
