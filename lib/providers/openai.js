// OpenAI yapılandırılmış metin sağlayıcısı — reklam senaryosu/copy için güvenilir JSON.
// fal kilitli + Higgsfield llm_text belirsiz olduğu için metin (LLM) varsayılanı budur.
// OPENAI_API_KEY .env.local'dan (icerik-ajani ile aynı anahtar).

const MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';

export async function generateStructured({ system, prompt }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY tanımlı değil (.env.local).');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system + ' Yanıtı GEÇERLİ tek bir JSON nesnesi olarak ver.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  try { return JSON.parse(text); } catch {
    const i = text.indexOf('{'), j = text.lastIndexOf('}');
    if (i >= 0 && j > i) { try { return JSON.parse(text.slice(i, j + 1)); } catch { return null; } }
    return null;
  }
}
