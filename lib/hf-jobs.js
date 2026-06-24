// Higgsfield iş (job) köprüsü — "Hazır içerik ekle (HF ID)" + kalan kredi rozeti için.
// CLI Asaf'ın hesabında oturumlu → web arayüzünde üretilen işler `generate get <id>` ile çekilebilir.
import { runHF, findUrl, IMG, VID } from './providers/higgsfield.js';

function parseJSON(stdout) {
  try { return JSON.parse(stdout); } catch {
    const i = Math.max(stdout.lastIndexOf('{'), stdout.lastIndexOf('['));
    if (i >= 0) { try { return JSON.parse(stdout.slice(i)); } catch { /* yoksay */ } }
  }
  return null;
}

// Bir HF işinin medyasını çöz → { url, kind:'image'|'video', model }
export async function getJobMedia(jobId) {
  const id = String(jobId || '').trim();
  if (!id) throw new Error('Higgsfield iş ID gerekli.');
  const out = await runHF(['generate', 'get', id], { timeoutMs: 120000 });
  const data = parseJSON(out);
  const status = data && (data.status || data.state);
  if (status && !/complete|success|done|finished/i.test(String(status))) {
    throw new Error(`İş henüz hazır değil (durum: ${status}). Higgsfield'de tamamlanmasını bekleyin.`);
  }
  // önce görsel, sonra video uzantısı dene
  const imgUrl = findUrl(data ?? out, IMG);
  if (imgUrl) return { url: imgUrl, kind: 'image', model: data?.model || null };
  const vidUrl = findUrl(data ?? out, VID);
  if (vidUrl) return { url: vidUrl, kind: 'video', model: data?.model || null };
  throw new Error('Bu iş için medya URL bulunamadı. ID doğru ve iş tamamlanmış mı?');
}

// Hesap durumu → { email, credits, plan }
export async function accountStatus() {
  const out = await runHF(['account', 'status'], { timeoutMs: 60000 });
  const data = parseJSON(out) || {};
  return {
    email: data.email || null,
    credits: typeof data.credits === 'number' ? data.credits : null,
    plan: data.subscription_plan_type || data.plan || null,
  };
}
