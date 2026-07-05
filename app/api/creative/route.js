import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { metaReklamRoot, productsJsonPath } from '@/lib/paths';
import { listCreatives, configPath } from '@/lib/reklam';
import { requireSpendConfirm } from '@/lib/credit-guard';

export const runtime = 'nodejs';
export const maxDuration = 600;

// GET ?slug=... → ürünün mevcut markalı creative'lerini listele.
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get('slug');
  if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
  const cfg = configPath(slug);
  return NextResponse.json({ ok: true, hasConfig: Boolean(cfg), creatives: listCreatives(slug) });
}

// POST { slug, sizes?, langs?, mode? } → creative'leri (yeniden) üret.
//  mode='framed' (VARSAYILAN): make_framed.py — standart "çerçeveli kart" düzeni.
//    Tek master fotoğraf üstüne saf marka overlay'ı → KREDİ YAKMAZ (fal/HF yok).
//  mode='cutout' (eski): make_product.py — cutout/props (fal/HF, kredi yakar, onay gerekir).
export async function POST(request) {
  try {
    const body = await request.json();
    const { slug, sizes, langs, mode = 'framed' } = body;
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    const cfg = configPath(slug);
    if (!cfg) return NextResponse.json({ ok: false, error: `Bu ürünün creative config'i yok (${slug}). Önce config oluşturulmalı.` }, { status: 400 });

    let script, args;
    if (mode === 'cutout') {
      // Kredi koruması — make_product.py fal/HF ile cutout/props üretir (kredi yakar).
      const guard = await requireSpendConfirm(body);
      if (!guard.ok) {
        return NextResponse.json({ ok: false, requiresConfirm: true, credits: guard.credits, plan: guard.plan,
          error: 'Manuel mod: cutout creative üretimi kredi yakar. Onay gerekli. (Standart framed düzeni kredi yakmaz.)' }, { status: 402 });
      }
      script = path.join(metaReklamRoot(), 'scripts', 'make_product.py');
      args = [script, cfg];
      if (Array.isArray(sizes) && sizes.length) args.push('--sizes', ...sizes);
    } else {
      // Standart: framed (çerçeveli kart) — kredi yakmaz, master fotoğraf üstüne overlay.
      script = path.join(metaReklamRoot(), 'scripts', 'make_framed.py');
      args = [script, cfg];
      if (Array.isArray(sizes) && sizes.length) args.push('--sizes', ...sizes);
      if (Array.isArray(langs) && langs.length) args.push('--langs', ...langs);
    }

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
