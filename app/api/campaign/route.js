import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { metaReklamRoot, stateFile, productsJsonPath } from '@/lib/paths';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Reklam motoru panele gömülü: reklam/scripts/panel_meta_campaign.py (tek kaynak).
function resolveScript() {
  return path.join(metaReklamRoot(), 'scripts', 'panel_meta_campaign.py');
}

// Meta kampanya PLANINI üretir (dry-run). panel_meta_campaign.py'yi products.json +
// panelin content.json'ı ile besler. Gerçek kurulum META_* token'ları gerektirir ve
// scriptte güvenli şekilde kapalıdır.
export async function POST(request) {
  try {
    const { slug, langs, daily, mode } = await request.json();
    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });

    const script = resolveScript();
    const contentPath = stateFile('content.json');
    const create = mode === 'create'; // gerçek PAUSED kurulum
    const args = [
      script,
      '--slug', slug,
      '--langs', ...(langs?.length ? langs : ['en']),
      '--daily', String(daily || 6),
      '--content', contentPath,
      create ? '--no-dry-run' : '--dry-run',
      '--emit-json',
    ];

    const out = await new Promise((resolve, reject) => {
      const py = spawn('python3', args, {
        cwd: path.dirname(path.dirname(script)),
        env: { ...process.env, PRODUCTS_JSON_PATH: productsJsonPath() },
      });
      let stdout = '', stderr = '';
      py.stdout.on('data', (d) => (stdout += d));
      py.stderr.on('data', (d) => (stderr += d));
      py.on('error', reject);
      py.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(stderr || `python çıkış kodu ${code}`))));
    });

    const plan = JSON.parse(out.trim().split('\n').pop());
    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
