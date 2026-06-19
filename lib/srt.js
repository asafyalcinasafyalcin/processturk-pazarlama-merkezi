// Onaylı metin sahnelerinden .srt altyazı üretir (fal gerektirmez).
// Her sahnenin caption/captionLines + durationSec'inden sıralı cue'lar oluşturur.

function ts(sec) {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(milli, 3)}`;
}

function sceneText(s) {
  if (Array.isArray(s.captionLines)) return s.captionLines.filter(Boolean).join('\n');
  if (s.caption) return s.caption;
  if (Array.isArray(s.lines)) return s.lines.filter(Boolean).join('\n');
  if (s.title) return s.title;
  return '';
}

export function buildSrt(scenes = []) {
  const cues = [];
  let t = 0;
  for (const s of scenes) {
    const dur = Number(s.durationSec) || 3;
    const text = sceneText(s).trim();
    if (text) cues.push({ start: t, end: t + dur, text });
    t += dur;
  }
  const srt = cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n');
  return { srt, cues, totalSec: t };
}
