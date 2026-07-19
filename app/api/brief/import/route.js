import { NextResponse } from 'next/server';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BRAND } from '@/lib/brand';
import { productsJsonPath, stateFile } from '@/lib/paths';
import { websiteBriefSource, buildWebsiteBrief } from '@/lib/website-brief';
// LLM KÖPRÜSÜ GÖÇÜ (2026-07-19): doğrudan api.openai.com fetch'leri kaldırıldı; tüm
// metin çağrıları tek kapıdan (lib/llm-koprusu.mjs) geçiyor — sağlayıcı/model/hata
// yönetimi tek yerde. Model (gpt-4o), sıcaklık, max_tokens, json modu ve tüm hata/
// fallback yolları BİREBİR korundu; köprü yeniden denemesi kapalı (denemeler: 0).
import { sohbet, LLMHatasi } from '../../../../lib/llm-koprusu.mjs';

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

  try {
    const y = await sohbet({
      mesajlar: [
        { rol: 'sistem', icerik: system },
        {
          rol: 'kullanici',
          icerik: `Ürün adı: ${productName}\n\nDoküman içeriği:\n${textContent.slice(0, grounded ? 12000 : 4000)}\n\nJSON şema:\n${schema}`,
        },
      ],
      model: 'gpt-4o',
      json: true,
      sicaklik: grounded ? 0.1 : 0.3,
      maxToken: 1000,
      denemeler: 0,
    });
    return y.json;
  } catch (e) {
    // Eski davranış: HTTP hatasında `GPT-4o hata: <durum>` — mesaj biçimi korunuyor.
    if (e instanceof LLMHatasi && e.durum) throw new Error(`GPT-4o hata: ${e.durum}`);
    throw e;
  }
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
          // Eski kod hatayı SESSİZCE yutuyordu (`if (res.ok)`), textContent boş kalıyordu
          // ve akış aşağıdaki "İçerik boş" kontrolüne düşüyordu — bu davranış korunuyor.
          try {
            const y = await sohbet({
              mesajlar: [{
                rol: 'kullanici',
                icerik: [
                  { type: 'text', text: `Bu PDF'teki ürün teknik bilgilerini çıkar ve düz metin olarak ver. Ürün: ${productName}` },
                  { type: 'image_url', image_url: { url: `data:application/pdf;base64,${b64}`, detail: 'high' } },
                ],
              }],
              model: 'gpt-4o',
              maxToken: 2000,
              denemeler: 0,
            });
            textContent = y.metin || '';
          } catch { /* eski davranış: hata yutulur, içerik boş kalır */ }
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
