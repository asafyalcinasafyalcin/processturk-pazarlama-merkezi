import { promises as fs } from 'node:fs';
import { dataDir, stateFile } from './paths.js';

// Panel ayarları: marka sesi + prosody + telaffuz sözlüğü + üretim modu.
// generationMode: 'manuel' (varsayılan) → otomatik HF üretimi açık onay ister (kredi koruması);
//                 'otomatik' → eski davranış, üretim doğrudan çalışır.
const FILE = () => stateFile('settings.json');
// imageTier/videoTier: kalite tier'ı (economy|standard|premium). VARSAYILAN = premium
// (Asaf kararı 2026-07-04: kalite şikayetinin kökü). Üretim başına body ile ezilebilir.
const DEFAULTS = { brandVoice: 'Brian', brandPreset: 'energetic', pronounce: {}, generationMode: 'manuel', imageTier: 'premium', videoTier: 'premium' };

export async function readSettings() {
  try {
    const raw = await fs.readFile(FILE(), 'utf-8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (err) {
    if (err.code === 'ENOENT') return { ...DEFAULTS };
    throw err;
  }
}

export async function patchSettings(patch) {
  await fs.mkdir(dataDir(), { recursive: true });
  const cur = await readSettings();
  const next = { ...cur, ...patch };
  await fs.writeFile(FILE(), JSON.stringify(next, null, 2) + '\n', 'utf-8');
  return next;
}
