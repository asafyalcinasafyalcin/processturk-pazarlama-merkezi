// Kredi koruması — manuel modda Higgsfield kredisi yakan üretimleri açık onay arkasına alır.
// Üretim rotaları (görsel/video) başına çağrılır.
//   - mod 'otomatik' → her zaman geçer
//   - mod 'manuel' + body.confirmSpend !== true → bloklar; kalan kredi döner
// Panel 402 + requiresConfirm görünce kullanıcıdan onay alıp confirmSpend:true ile tekrar gönderir.
import { readSettings } from './settings.js';
import { accountStatus } from './hf-jobs.js';

export async function requireSpendConfirm(body = {}) {
  const settings = await readSettings();
  if (settings.generationMode !== 'manuel') return { ok: true };
  if (body.confirmSpend === true) return { ok: true };

  // Kalan krediyi göster (CLI erişilemezse null) — onay diyaloğu için bilgilendirici.
  let credits = null, plan = null;
  try { const acc = await accountStatus(); credits = acc.credits; plan = acc.plan; }
  catch { /* kredi okunamazsa yine de blokla */ }

  return { ok: false, credits, plan };
}
