// Tek-admin oturum katmanı (Faz 0 — acil güvenlik yaması).
// Panel bugüne kadar TAMAMEN AÇIKTI (giriş yoktu) ve gerçek sosyal hesaplara yayın
// yapabiliyordu. Bu dosya Web Sitesi'nin `src/lib/auth.ts` desenini örnek alır ama
// Prisma/User henüz yokken (bkz. plan Faz 2) tek paylaşılan şifre + imzalı çerezle çalışır.
//
// Web Crypto API (`crypto.subtle`) kasten kullanıldı — hem Node route handler'larında
// hem Edge middleware'de değişiklik yapmadan çalışır, yeni paket (jose/bcrypt) gerekmez.
const encoder = new TextEncoder();

async function getKey() {
  const secret = process.env.AUTH_SECRET || 'processturk-pazarlama-dev-secret';
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sabitZamanEsit(a, b) {
  if (a.length !== b.length) return false;
  let fark = 0;
  for (let i = 0; i < a.length; i++) fark |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return fark === 0;
}

export const SESSION_COOKIE = 'pazarlama_oturum';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 gün (saniye)

export async function createSessionToken() {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const value = `${exp}:admin`;
  const key = await getKey();
  const sig = toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return `${value}.${sig}`;
}

export async function isValidSession(token) {
  if (!token) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const value = token.slice(0, i);
  const sig = token.slice(i + 1);
  const key = await getKey();
  const expectedSig = toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  if (!sabitZamanEsit(sig, expectedSig)) return false;
  const [expStr] = value.split(':');
  return Date.now() <= Number(expStr);
}

// ADMIN_PASSWORD .env.local'de düz metin tutulur (QUICK_PUBLISH_TOKEN ile aynı desen —
// bu panelin zaten kullandığı basit paylaşılan-sır yaklaşımı; secret dosyaları asla commit
// edilmez). Faz 2'de Prisma User + hash'e taşınabilir.
export function checkPassword(pw) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !pw) return false;
  return sabitZamanEsit(String(pw), expected);
}
