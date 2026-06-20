import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { metaReklamRoot, productsJsonPath } from '@/lib/paths';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Meta Insights (READ-ONLY) raporu — meta_report.py --emit-json çalıştırır.
// PAUSED kampanyada veri boş döner (normal); yapı doğruysa yayında dolar.
export async function POST(request) {
  try {
    const { preset } = await request.json().catch(() => ({}));
    const script = path.join(metaReklamRoot(), 'scripts', 'meta_report.py');
    const args = [script, '--preset', preset || 'last_7d', '--emit-json'];

    const out = await new Promise((resolve, reject) => {
      const py = spawn('python3', args, {
        cwd: metaReklamRoot(),
        env: { ...process.env, PRODUCTS_JSON_PATH: productsJsonPath() },
      });
      let stdout = '', stderr = '';
      py.stdout.on('data', (d) => (stdout += d));
      py.stderr.on('data', (d) => (stderr += d));
      py.on('error', reject);
      py.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(stderr || `python çıkış kodu ${code}`))));
    });

    const data = JSON.parse(out.trim().split('\n').pop());
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
