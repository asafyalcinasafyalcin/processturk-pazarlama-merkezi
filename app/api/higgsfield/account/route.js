// Higgsfield hesap durumu — paneldeki kalan kredi rozeti + kredi onay diyaloğu için.
import { NextResponse } from 'next/server';
import { accountStatus } from '@/lib/hf-jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const acc = await accountStatus();
    return NextResponse.json({ ok: true, ...acc });
  } catch (err) {
    // CLI yoksa/oturum düşmüşse panel sessizce krediyi gizler
    return NextResponse.json({ ok: false, error: err.message, credits: null }, { status: 200 });
  }
}
