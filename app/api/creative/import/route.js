// Hazır reklam creative'i panele getir: Higgsfield Job ID / URL / dosya (görsel).
//   - brand:true (varsayılan) → görsel cutout.png olarak yazılır, make_product.py --overlay-only ile
//     SADECE marka katmanı render edilir (fal/HF çağrılmaz → kredi yakmaz).
//   - brand:false → ham görsel doğrudan creative olarak listelenir.
// Not: Reklam creative'leri statik görseldir; video reklam ayrı (campaign.video_url).
import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { metaReklamRoot, productsJsonPath } from '@/lib/paths';
import { listCreatives, configPath, creativeDir } from '@/lib/reklam';
import { saveFromUrl, saveBuffer } from '@/lib/media-store';
import { getJobMedia } from '@/lib/hf-jobs';

export const runtime = 'nodejs';
export const maxDuration = 600;

const IMG_MIME_EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MEDIA_IMG_URL_RE = /^https?:\/\/.+\.(png|jpe?g|webp)(\?.*)?$/i;

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, opts);
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err || out || `çıkış kodu ${code}`))));
  });
}

// Herhangi bir görsel → geçerli PNG (PIL). cutout.png ve ham creative için kullanılır.
async function toPng(src, dst) {
  await run('python3', ['-c',
    'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("RGBA").save(sys.argv[2])',
    src, dst]);
}

export async function POST(request) {
  try {
    const ctype = request.headers.get('content-type') || '';
    let slug, source, value, brand = true, file = null;

    if (ctype.includes('multipart/form-data')) {
      const fd = await request.formData();
      slug = fd.get('slug'); source = 'upload'; file = fd.get('file');
      brand = fd.get('brand') !== 'false';
    } else {
      const b = await request.json();
      slug = b.slug; source = b.source; value = b.value; brand = b.brand !== false;
    }

    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });
    const dir = creativeDir(slug);
    if (!dir) return NextResponse.json({ ok: false, error: `Bu ürünün creative config'i yok (${slug}). Önce config oluşturulmalı.` }, { status: 400 });

    // 1) Medyayı çöz → media-store'da bir görsel dosyası (absPath)
    let mediaPath;
    if (source === 'hf-id') {
      const r = await getJobMedia(value);
      if (r.kind !== 'image') return NextResponse.json({ ok: false, error: 'Reklam creative için görsel gerekli (bu iş video).' }, { status: 400 });
      ({ absPath: mediaPath } = await saveFromUrl(r.url, { slug, type: 'gorsel' }));
    } else if (source === 'url') {
      const url = String(value || '').trim();
      if (!MEDIA_IMG_URL_RE.test(url)) return NextResponse.json({ ok: false, error: 'Geçerli bir görsel URL girin (png/jpg/webp).' }, { status: 400 });
      ({ absPath: mediaPath } = await saveFromUrl(url, { slug, type: 'gorsel' }));
    } else if (source === 'upload') {
      if (!file) return NextResponse.json({ ok: false, error: 'file zorunlu' }, { status: 400 });
      const ext = IMG_MIME_EXT[file.type || ''];
      if (!ext) return NextResponse.json({ ok: false, error: 'Yalnızca görsel (JPG/PNG/WEBP) yükleyebilirsiniz.' }, { status: 400 });
      const buf = Buffer.from(await file.arrayBuffer());
      ({ absPath: mediaPath } = saveBuffer(buf, { slug, type: 'gorsel', ext }));
    } else {
      return NextResponse.json({ ok: false, error: `Bilinmeyen kaynak: ${source}` }, { status: 400 });
    }

    // 2a) Ham mod → doğrudan creative olarak listele (overlay yok)
    if (!brand) {
      const out = path.join(dir, `${slug}-manuel-${Date.now()}.png`);
      await toPng(mediaPath, out);
      return NextResponse.json({ ok: true, mode: 'raw', creatives: listCreatives(slug) });
    }

    // 2b) Markala (overlay) → cutout.png yaz, make_product.py --overlay-only (fal/HF YOK)
    await toPng(mediaPath, path.join(dir, 'cutout.png'));
    const cfg = configPath(slug);
    const script = path.join(metaReklamRoot(), 'scripts', 'make_product.py');
    const log = await run('python3', [script, cfg, '--overlay-only'], {
      cwd: metaReklamRoot(),
      env: { ...process.env, PRODUCTS_JSON_PATH: productsJsonPath() },
    });

    return NextResponse.json({ ok: true, mode: 'overlay', log, creatives: listCreatives(slug) });
  } catch (err) {
    console.error('[creative/import]', err);
    return NextResponse.json({ ok: false, error: String(err.message || err) }, { status: 500 });
  }
}
