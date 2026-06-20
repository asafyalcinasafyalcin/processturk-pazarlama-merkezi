import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { metaReklamRoot, productsJsonPath } from '@/lib/paths';
import { listCreatives, configPath } from '@/lib/reklam';

export const runtime = 'nodejs';
export const maxDuration = 600;

// GET ?slug=... → ürünün mevcut markalı creative'lerini listele.
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get('slug');
  if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
  const cfg = configPath(slug);
  return NextResponse.json({ ok: true, hasConfig: Boolean(cfg), creatives: listCreatives(slug) });
}

// POST { slug, sizes? } → make_product.py ile creative'leri (yeniden) üret.
// Cutout/props varsa fal'a gitmeden sadece marka overlay'ı render eder.
export async function POST(request) {
  try {
    const { slug, sizes } = await request.json();
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    const cfg = configPath(slug);
    if (!cfg) return NextResponse.json({ ok: false, error: `Bu ürünün creative config'i yok (${slug}). Önce config oluşturulmalı.` }, { status: 400 });

    const script = path.join(metaReklamRoot(), 'scripts', 'make_product.py');
    const args = [script, cfg];
    if (Array.isArray(sizes) && sizes.length) args.push('--sizes', ...sizes);

    const log = await new Promise((resolve, reject) => {
      const py = spawn('python3', args, {
        cwd: metaReklamRoot(),
        env: { ...process.env, PRODUCTS_JSON_PATH: productsJsonPath() },
      });
      let stdout = '', stderr = '';
      py.stdout.on('data', (d) => (stdout += d));
      py.stderr.on('data', (d) => (stderr += d));
      py.on('error', reject);
      py.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `python çıkış kodu ${code}`))));
    });

    return NextResponse.json({ ok: true, log, creatives: listCreatives(slug) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
