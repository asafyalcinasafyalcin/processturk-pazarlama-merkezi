// Seslendirmeden ÖNCE metni "okunur" hale getir — Türkçe yanlış okuma kök çözümü.
// SSML'e bel bağlamadan: sayı→yazı, sembol→sözel, telaffuz sözlüğü.
// Marka telaffuzu brand.js'ten (BRAND.ttsPronounce) — BRAND_ID yoksa ProcessTürk varsayılanı.
import { BRAND } from './brand.js';

const ONES = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];

function spell3(x) {
  const h = Math.floor(x / 100), t = Math.floor((x % 100) / 10), o = x % 10;
  const parts = [];
  if (h) parts.push((h === 1 ? '' : ONES[h] + ' ') + 'yüz');
  if (t) parts.push(TENS[t]);
  if (o) parts.push(ONES[o]);
  return parts.join(' ').trim();
}

// 0–999.999 TR sayı → yazı
export function spellTR(n) {
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) return '';
  if (n === 0) return 'sıfır';
  const th = Math.floor(n / 1000), rest = n % 1000;
  let out = '';
  if (th) out += (th === 1 ? '' : spell3(th) + ' ') + 'bin';
  if (rest) out += (out ? ' ' : '') + spell3(rest);
  return out.trim();
}

const SPOKEN_UNIT = {
  'adet/saat': { prefix: 'saatte', word: 'adet' },
  'şişe/dakika': { prefix: 'dakikada', word: 'şişe' },
  'litre/saat': { prefix: 'saatte', word: 'litre' },
  'adet/dakika': { prefix: 'dakikada', word: 'adet' },
};

const DEFAULT_DICT = {
  // Marka telaffuzu marka kaydından (BRAND.ttsPronounce); genel terimler sabit.
  ...(BRAND.ttsPronounce || {}),
  '7/24': 'yedi yirmi dört',
  '304': 'üç yüz dört',
};

function toInt(s) { return Number(String(s).replace(/[.\s]/g, '')); }

// TR metin normalizasyonu
export function normalizeForTTS(text, lang = 'tr', dict = {}) {
  let s = String(text || '');
  const D = { ...DEFAULT_DICT, ...dict };

  // Telaffuz sözlüğü (marka/terim) — önce uzun anahtarlar
  for (const k of Object.keys(D).sort((a, b) => b.length - a.length)) {
    s = s.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), D[k]);
  }

  if (lang === 'tr') {
    // birimli aralık: "600–1.000 adet/saat" → "saatte altı yüz ila bin adet"
    const unitAlt = Object.keys(SPOKEN_UNIT).join('|').replace(/\//g, '\\/');
    s = s.replace(new RegExp(`(\\d[\\d.]*)\\s*[-–]\\s*(\\d[\\d.]*)\\s*(${unitAlt})`, 'gi'), (m, a, b, u) => {
      const su = SPOKEN_UNIT[u.toLowerCase()] || { prefix: '', word: '' };
      return `${su.prefix} ${spellTR(toInt(a))} ila ${spellTR(toInt(b))} ${su.word}`.trim();
    });
    // birimli tek sayı: "1.000 adet/saat"
    s = s.replace(new RegExp(`(\\d[\\d.]*)\\s*(${unitAlt})`, 'gi'), (m, a, u) => {
      const su = SPOKEN_UNIT[u.toLowerCase()] || { prefix: '', word: '' };
      return `${su.prefix} ${spellTR(toInt(a))} ${su.word}`.trim();
    });
    // yüzde
    s = s.replace(/%\s*(\d[\d.]*)/g, (m, a) => `yüzde ${spellTR(toInt(a))}`);
    // kalan sayı aralıkları "x–y"
    s = s.replace(/(\d[\d.]*)\s*[-–]\s*(\d[\d.]*)/g, (m, a, b) => `${spellTR(toInt(a))} ila ${spellTR(toInt(b))}`);
    // kalan tek sayılar
    s = s.replace(/\d[\d.]*/g, (m) => spellTR(toInt(m)));
  }

  // Genel sembol temizliği (tüm diller)
  s = s.replace(/\s*\/\s*/g, ' ').replace(/\s*[–-]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return s;
}
