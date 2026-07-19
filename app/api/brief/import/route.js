import { NextResponse } from 'next/server';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BRAND } from '@/lib/brand';
import { productsJsonPath, stateFile } from '@/lib/paths';
import { websiteBriefSource, buildWebsiteBrief } from '@/lib/website-brief';

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

async function extractBriefWithGPT(textContent, productName, openaiKey, { grounded = false } = {}) {
  const system = `Sen ${BRAND.promptName} için ürün pazarlama brief'i çıkarıyorsun.
Verilen metin ürün kataloğu, teknik doküman veya müşteri notu olabilir.
KURAL: Fiyat bilgisi asla yazma. "Avrupa menşeli", "ithal", "en ucuz" kullanma.${grounded ? `
TOPRAKLAMA KURALI (KRİTİK): Kaynak metin şirketin web sitesinden gelen RESMİ ürün verisidir.
SADECE bu metinde geçen bilgi, rakam ve özellikleri kullan. Metinde OLMAYAN hiçbir kapasite,
özellik, sertifika, malzeme veya iddia YAZMA. Emin olmadığın alanı boş bırak — uydurma.` : ''}
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
      temperature: grounded ? 0.1 : 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Ürün adı: ${productName}\n\nDoküman içeriği:\n${textContent.slice(0, grounded ? 12000 : 4000)}\n\nJSON şema:\n${schema}`,
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

    const formData = await request.formData();
    const slug = formData.get('slug');
    const textInput = formData.get('text');
    const file = formData.get('file');
    const mode = formData.get('mode') || ''; // 'website' → kaynak sitenin senkron verisi, topraklama açık

    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });

    // Ürün adını al (+ website modunda ürün kaydının kendisi lazım)
    let productName = slug;
    let productRec = null;
    try {
      const products = JSON.parse(fs.readFileSync(productsJsonPath(), 'utf8'));
      productRec = products.find((x) => x.slug === slug) || null;
      if (productRec) productName = productRec.marketing?.name_tr || productRec.name_en || slug;
    } catch { /* devam et */ }

    let textContent = '';

    if (mode === 'website') {
      // Kaynak metni SUNUCU üretir (istemcinin eski/stale verisi değil) — sitenin
      // senkronla gelen tam içeriği (açıklama, SSS, akış…) brief'in tek kaynağıdır.
      if (!productRec?.website) {
        return NextResponse.json({ ok: false, error: 'Ürün web sitesine bağlı değil — önce Siteyle Eşitle.' }, { status: 400 });
      }
      textContent = websiteBriefSource(productRec);
    } else if (textInput && textInput.trim()) {
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

    // Website modu: deterministik taban her zaman hazırdır (%100 site verisi, sıfır hayal).
    const detBase = mode === 'website' ? buildWebsiteBrief(productRec) : null;

    if (!openaiKey) {
      if (detBase) {
        // Anahtar yok → LLM'siz, doğrudan site verisinden brief (uydurma imkânsız).
        const briefPath = path.join(stateFile('briefs'), `${slug}.json`);
        fs.mkdirSync(path.dirname(briefPath), { recursive: true });
        fs.writeFileSync(briefPath, JSON.stringify(detBase, null, 2));
        return NextResponse.json({ ok: true, brief: detBase, note: 'OPENAI_API_KEY yok — brief doğrudan site verisinden derlendi.' });
      }
      return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY eksik' }, { status: 500 });
    }

    const parsed = await extractBriefWithGPT(textContent, productName, openaiKey, { grounded: mode === 'website' });

    const brief = {
      slug,
      approved: false,
      // Website modunda boş dönen alanlar deterministik site tabanıyla doldurulur.
      highlights: (parsed.highlights?.length ? parsed.highlights : detBase?.highlights) || [],
      target_industries: (parsed.target_industries?.length ? parsed.target_industries : detBase?.target_industries) || [],
      ideal_customer: parsed.ideal_customer || detBase?.ideal_customer || '',
      pain_points: parsed.pain_points || [],
      dont_say: parsed.dont_say?.length ? parsed.dont_say : (detBase?.dont_say || []),
      image_notes: parsed.image_notes || detBase?.image_notes || '',
      ...(detBase?.website_source ? { website_source: detBase.website_source } : {}),
      last_updated: new Date().toISOString(),
      _generated_by: mode === 'website' ? 'brief/import / gpt-4o (site verisi, topraklamalı)' : 'brief/import / gpt-4o',
    };

    const briefPath = path.join(stateFile('briefs'), `${slug}.json`);
    fs.mkdirSync(path.dirname(briefPath), { recursive: true });
    fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2));

    return NextResponse.json({ ok: true, brief });
  } catch (err) {
    console.error('[brief/import]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
