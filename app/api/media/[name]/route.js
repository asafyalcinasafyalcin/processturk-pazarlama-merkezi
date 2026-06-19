import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { APP_ROOT } from '@/lib/paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Render edilen mp4'leri sun (next start public/ runtime dosyalarını sunmuyor).
export async function GET(request, { params }) {
  const { name } = await params;
  // güvenlik: yalnızca dosya adı, dizin geçişi yok
  const safe = path.basename(name || '');
  if (!safe.endsWith('.mp4')) return new Response('Not found', { status: 404 });
  const file = path.join(APP_ROOT, 'public', 'renders', safe);
  if (!existsSync(file)) return new Response('Not found', { status: 404 });
  const size = statSync(file).size;
  const stream = createReadStream(file);
  return new Response(stream, {
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size), 'Cache-Control': 'public, max-age=86400' },
  });
}
