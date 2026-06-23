import { NextResponse } from 'next/server';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const execAsync = promisify(exec);

export const runtime = 'nodejs';
export const maxDuration = 60;

async function pdfToText(pdfBuffer) {
  const tmpPdf = path.join(os.tmpdir(), `product-import-${Date.now()}.pdf`);
  fs.writeFileSync(tmpPdf, pdfBuffer);
  try {
    const { stdout } = await execAsync(`pdftotext "${tmpPdf}" -`);
    fs.unlinkSync(tmpPdf);
    return stdout.trim();
  } catch {
    try { fs.unlinkSync(tmpPdf); } catch { /* ignore */ }
    return null;
  }
}

async function extractProductWithGPT(textContent, openaiKey) {
  const schema = JSON.stringify({
    name_tr: 'Türkçe ürün adı',
    name_en: 'English product name',
    category: 'Filling / Granule / Liquid vb.',
    notes: 'Tek cümle açıklama',
    specs: {
      filled_products: 'Hangi ürünleri doldurur',
      filling_range: 'Dolum aralığı (gr/ml)',
      capacity: 'Kapasite (adet/saat)',
      size: 'Ebat (cm)',
      power: 'Güç (Watt)',
      voltage: 'Voltaj (V/Hz)',
    },
    audience: 'Hedef kitle tek cümle',
    promise: 'Tek cümle değer vaadi',
    hero_number: 'Öne çıkan rakam veya başlangıç fiyatı',
  });

  const system = `Sen ProcessTürk için ürün veri kartı çıkarıyorsun.
Verilen metin makine kataloğu veya teknik doküman olabilir.
KURAL: Fiyat bilgisi hero_number'a SADECE "X$'dan başlar" biçiminde ekle, ham rakam değil.
SADECE minified JSON döndür — açıklama yok.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1200,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Doküman içeriği:\n${textContent.slice(0, 5000)}\n\nJSON şema:\n${schema}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`GPT-4o hata: ${res.status}`);
  const d = await res.json();
  return JSON.parse(d.choices[0].message.content);
}

export async function POST(request) {
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY eksik' }, { status: 500 });

    const formData = await request.formData();
    const textInput = formData.get('text');
    const file = formData.get('file');

    let textContent = '';

    if (textInput && textInput.trim()) {
      textContent = textInput.trim();
    } else if (file) {
      const buf = Buffer.from(await file.arrayBuffer());
      const mime = file.type || '';

      if (mime.includes('pdf') || file.name?.endsWith('.pdf')) {
        const extracted = await pdfToText(buf);
        if (extracted) {
          textContent = extracted;
        } else {
          // GPT-4o vision fallback
          const b64 = buf.toString('base64');
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
            body: JSON.stringify({
              model: 'gpt-4o',
              max_tokens: 2000,
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: 'Bu PDF\'teki makine teknik bilgilerini düz metin olarak çıkar.' },
                  { type: 'image_url', image_url: { url: `data:application/pdf;base64,${b64}`, detail: 'high' } },
                ],
              }],
            }),
          });
          if (res.ok) {
            const d = await res.json();
            textContent = d.choices[0].message.content || '';
          }
        }
      } else {
        textContent = buf.toString('utf8');
      }
    }

    if (!textContent.trim()) {
      return NextResponse.json({ ok: false, error: 'İçerik boş — metin girin veya dosya seçin' }, { status: 400 });
    }

    const parsed = await extractProductWithGPT(textContent, openaiKey);

    return NextResponse.json({ ok: true, product: parsed });
  } catch (err) {
    console.error('[products/import-pdf]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
