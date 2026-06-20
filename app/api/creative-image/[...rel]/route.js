import fs from 'node:fs';
import { resolveCreativeImage } from '@/lib/reklam';

export const runtime = 'nodejs';

// Güvenli PNG servisi: reklam/campaigns ağacındaki creative görsellerini sunar.
// next start public/ runtime dosyalarını sunmadığı için (video media rotası deseni).
export async function GET(request, { params }) {
  const { rel } = await params;
  const relPath = Array.isArray(rel) ? rel.join('/') : String(rel || '');
  const full = resolveCreativeImage(relPath);
  if (!full) return new Response('Not found', { status: 404 });
  const buf = fs.readFileSync(full);
  return new Response(buf, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  });
}
