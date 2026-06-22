import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { APP_ROOT, dataDir } from '@/lib/paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME = {
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

// Render edilen medya dosyalarını sun (mp4, png, jpg).
// Önce public/renders/ bakar (build'e baked-in), bulamazsa data/renders/ bakar
// (VPS'e scp ile kopyalanan kalıcı mount).
export async function GET(request, { params }) {
  const { name } = await params;
  // güvenlik: yalnızca dosya adı, dizin geçişi yok
  const safe = path.basename(name || '');
  const ext = path.extname(safe).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return new Response('Not found', { status: 404 });

  // Arama sırası: 1) public/renders  2) data/renders
  const candidates = [
    path.join(APP_ROOT, 'public', 'renders', safe),
    path.join(dataDir(), 'renders', safe),
  ];
  const file = candidates.find(existsSync);
  if (!file) return new Response('Not found', { status: 404 });

  const size = statSync(file).size;
  const stream = createReadStream(file);
  return new Response(stream, {
    headers: { 'Content-Type': mime, 'Content-Length': String(size), 'Cache-Control': 'public, max-age=86400' },
  });
}
