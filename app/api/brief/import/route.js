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
  const tmpPdf = path.join(os.tmpdir(), `brief-import-${Date.now()}.pdf`);
  fs.writeFileSync(tmpPdf, pdfBuffer);
  try {
    const { stdout } = await execAsync(`pdftotext "${tmpPdf}" -`);
    fs.unlinkSync(tmpPdf);
    return stdout.trim();
  } catch {
    // pdftotext yoksa OpenAI vision'a düş
    fs.unlinkSync(tmpPdf);
    return null;
  }
}

async function extractBriefWithGPT(textContent, productName, openaiKey) {
  const system = `Sen ProcessTürk için ürün pazarlama brief'i çıkarıyorsun.
Verilen metin ürün kataloğu, teknik doküman veya müşteri notu olabilir.
KURAL: Fiyat bilgisi asla yazma. "Avrupa menşeli", "ithal", "en ucuz" kullanma.
SADECE minified JSON döndür — açıklama yok.`;

  const schema = JSON.stringify({
    highlights: ['3-5 kısa teknik özellik/fark cümlesi'],
    target_industries: ['2-4 sektör'],
    ideal_customer: 'Hedef müşteri tek cümle',
    pain_points: ['2-3 müşteri sorunu'],
    dont_say: ['kullanılmaması gereken ifadeler'],
    image_notes: 'Görsel için ortam/materyal notu',
  });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1000,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Ürün adı: ${productName}\n\nDoküman içeriği:\n${textContent.slice(0, 4000)}\n\nJSON şema:\n${schema}`,
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
    const slug = formData.get('slug');
    const textInput = formData.get('text');
    const file = formData.get('file');

    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });

    // Ürün adını al
    let productName = slug;
    try {
      const products = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'products.json'), 'utf8'));
      const p = products.find((x) => x.slug === slug);
      if (p) productName = p.marketing?.name_tr || p.name_en || slug;
    } catch { /* devam et */ }

    let textContent = '';

    if (textInput && textInput.trim()) {
      // Toplu metin yapıştırma
      textContent = textInput.trim();
    } else if (file) {
      // Dosya yükleme
      const buf = Buffer.from(await file.arrayBuffer());
      const mime = file.type || '';

      if (mime.includes('pdf') || file.name?.endsWith('.pdf')) {
        const extracted = await pdfToText(buf);
        if (extracted) {
          textContent = extracted;
        } else {
          // pdftotext başarısız → GPT-4o vision ile base64
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
                  { type: 'text', text: `Bu PDF'teki ürün teknik bilgilerini çıkar ve düz metin olarak ver. Ürün: ${productName}` },
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
        // Düz metin dosyası
        textContent = buf.toString('utf8');
      }
    }

    if (!textContent.trim()) {
      return NextResponse.json({ ok: false, error: 'İçerik boş — metin girin veya dosya seçin' }, { status: 400 });
    }

    const parsed = await extractBriefWithGPT(textContent, productName, openaiKey);

    const brief = {
      slug,
      approved: false,
      highlights: parsed.highlights || [],
      target_industries: parsed.target_industries || [],
      ideal_customer: parsed.ideal_customer || '',
      pain_points: parsed.pain_points || [],
      dont_say: parsed.dont_say || [],
      image_notes: parsed.image_notes || '',
      last_updated: new Date().toISOString(),
      _generated_by: 'brief/import / gpt-4o',
    };

    const briefPath = path.join(process.cwd(), 'data', 'briefs', `${slug}.json`);
    fs.mkdirSync(path.dirname(briefPath), { recursive: true });
    fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2));

    return NextResponse.json({ ok: true, brief });
  } catch (err) {
    console.error('[brief/import]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
