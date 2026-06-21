import { NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);

async function checkHiggsfield() {
  const bin = process.env.HIGGSFIELD_BIN || 'higgsfield';
  const home = process.env.HOME || '/root';
  const credFile = `${home}/.config/higgsfield/credentials.json`;
  const credExists = existsSync(credFile);

  try {
    await execFileAsync(bin, ['--version'], { timeout: 5000 });
    return { ok: credExists, binary: true, credentials: credExists, warn: credExists ? null : 'credentials.json yok — HF_CREDENTIALS_JSON set edilmeli' };
  } catch {
    return { ok: false, binary: false, credentials: credExists, warn: 'Higgsfield CLI bulunamadı veya çalışmıyor' };
  }
}

async function checkFal() {
  const key = process.env.FAL_KEY;
  if (!key) return { ok: false, warn: 'FAL_KEY tanımlı değil' };
  return { ok: true };
}

async function checkOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, warn: 'OPENAI_API_KEY tanımlı değil' };
  return { ok: true };
}

async function checkFFmpeg() {
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });
    return { ok: true };
  } catch {
    return { ok: false, warn: 'ffmpeg bulunamadı' };
  }
}

export async function GET() {
  const [hf, fal, openai, ffmpeg] = await Promise.all([
    checkHiggsfield(),
    checkFal(),
    checkOpenAI(),
    checkFFmpeg(),
  ]);

  const genProvider = process.env.GEN_PROVIDER || 'fal';
  const activeProvider = genProvider === 'higgsfield' && !hf.ok ? 'fal (otomatik fallback)' : genProvider;

  const allOk = fal.ok && openai.ok; // fal veya HF'den en az biri yeterli
  const warnings = [hf.warn, fal.warn, openai.warn, ffmpeg.warn].filter(Boolean);

  return NextResponse.json({
    ok: allOk,
    service: 'pazarlama-merkezi',
    time: new Date().toISOString(),
    genProvider,
    activeProvider,
    providers: { higgsfield: hf, fal, openai, ffmpeg },
    warnings,
  });
}
