import { promises as fs } from 'node:fs';
import path from 'node:path';
import { dataDir } from './paths.js';

// Append-only JSON Lines. fs.appendFile atomik-ish; JSON dosyasını komple yeniden
// yazmadığımız için eşzamanlı yazım riski (mevcut calendar.json sorunu) BURADA yok.
export async function audit(entry) {
  try {
    await fs.mkdir(dataDir(), { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
    await fs.appendFile(path.join(dataDir(), 'audit-log.jsonl'), line, 'utf-8');
  } catch (e) {
    console.error('[audit] yazılamadı:', e.message); // audit hatası ana akışı düşürmesin
  }
}
