import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'data', 'saved-country-groups.json');

function readGroups() {
  if (!fs.existsSync(FILE)) return [];
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
}

function writeGroups(groups) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(groups, null, 2));
}

export async function GET() {
  return NextResponse.json({ ok: true, groups: readGroups() });
}

export async function POST(request) {
  try {
    const { label, codes } = await request.json();
    if (!label || !Array.isArray(codes) || codes.length === 0)
      return NextResponse.json({ ok: false, error: 'label ve codes zorunlu' }, { status: 400 });
    const groups = readGroups();
    const id = `custom-${Date.now()}`;
    const newGroup = { id, label, codes, createdAt: new Date().toISOString() };
    groups.push(newGroup);
    writeGroups(groups);
    return NextResponse.json({ ok: true, group: newGroup });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();
    const groups = readGroups().filter((g) => g.id !== id);
    writeGroups(groups);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
