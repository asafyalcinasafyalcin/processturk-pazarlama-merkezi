import { promises as fs } from 'node:fs';
import { dataDir, stateFile } from './paths.js';

// Panel ayarları: marka sesi + prosody + telaffuz sözlüğü.
const FILE = () => stateFile('settings.json');
const DEFAULTS = { brandVoice: 'Brian', brandPreset: 'energetic', pronounce: {} };

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
