import { NextResponse } from 'next/server';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BRAND } from '@/lib/brand';
// LLM KÖPRÜSÜ GÖÇÜ (2026-07-19): doğrudan api.openai.com fetch'leri kaldırıldı; tüm
// metin çağrıları tek kapıdan (lib/llm-koprusu.mjs) geçiyor — sağlayıcı/model/hata
// yönetimi tek yerde. Model (gpt-4o), sıcaklık, max_tokens, json modu ve tüm hata/
// fallback yolları BİREBİR korundu; köprü yeniden denemesi kapalı (denemeler: 0).
import { sohbet, LLMHatasi } from '../../../../lib/llm-koprusu.mjs';

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

  const system = `Sen ${BRAND.promptName} için ürün veri kartı çıkarıyorsun.
Verilen metin makine kataloğu veya teknik doküman olabilir.
KURAL: Fiyat bilgisi hero_number'a SADECE "X$'dan başlar" biçiminde ekle, ham rakam değil.
SADECE minified JSON döndür — açıklama yok.`;

  try {
    const y = await sohbet({
      mesajlar: [
        { rol: 'sistem', icerik: system },
        {
          rol: 'kullanici',
          icerik: `Doküman içeriği:\n${textContent.slice(0, 5000)}\n\nJSON şema:\n${schema}`,
        },
      ],
      model: 'gpt-4o',
      json: true,
      sicaklik: 0.2,
      maxToken: 1200,
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
          // Eski kod hatayı SESSİZCE yutuyordu (`if (res.ok)`), textContent boş kalıyordu
          // ve akış aşağıdaki "İçerik boş" kontrolüne düşüyordu — bu davranış korunuyor.
          try {
            const y = await sohbet({
              mesajlar: [{
                rol: 'kullanici',
                icerik: [
                  { type: 'text', text: 'Bu PDF\'teki makine teknik bilgilerini düz metin olarak çıkar.' },
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
