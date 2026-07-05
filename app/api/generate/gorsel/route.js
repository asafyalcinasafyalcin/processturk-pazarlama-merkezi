import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { findProduct } from '@/lib/products';
import { patchContent, getContent } from '@/lib/content';
import { genImage } from '@/lib/providers/gen';
import { resolveProductImagePath } from '@/lib/product-image';
import { findTemplate } from '@/lib/templates';
import { resolveFormat, FAL_TO_HF_RATIO } from '@/lib/platform-format';
import { downloadAndSave } from '@/lib/download-asset';
import { addToLibrary } from '@/lib/library';
import { requireSpendConfirm } from '@/lib/credit-guard';
import { servedToAbs } from '@/lib/media-store';
import { readSettings } from '@/lib/settings';
import { resolveTier, imageModelForTier, DEFAULT_TIER } from '@/lib/quality-tiers';

function loadMaskotConfig() {
  try {
    const p = join(process.cwd(), '..', '_core', 'maskot', 'soul-id.json');
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return { status: 'not-trained', reference_id: null };
  }
}

const MASKOT_REFERENCE_IMG = join(process.cwd(), '..', '_core', 'maskot', 'mascot-wave.png');

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request) {
  try {
    const body = await request.json();
    const { slug, template: templateId = 'makine-vitrin', lang = 'tr', platforms = ['instagram'], concept = null, provider = null } = body;

    if (!slug) return NextResponse.json({ ok: false, error: 'slug zorunlu' }, { status: 400 });

    // Kredi koruması — manuel modda açık onay gerekir (kredi yakar)
    const guard = await requireSpendConfirm(body);
    if (!guard.ok) {
      return NextResponse.json({ ok: false, requiresConfirm: true, credits: guard.credits, plan: guard.plan,
        error: 'Manuel mod: görsel üretimi kredi yakar. Onay gerekli.' }, { status: 402 });
    }

    const product = await findProduct(slug);
    if (!product) return NextResponse.json({ ok: false, error: 'Ürün bulunamadı' }, { status: 404 });

    // Slug cache: aynı slug+template+lang için ≤7 günlük sonuç varsa tekrar üretme.
    // force:true ile aşılır (gen.js prompt-hash cache da devre dışı kalır).
    if (!body.force) {
      const existing = await getContent(slug);
      const g = existing?.gorsel;
      if (g?.url && g.template === templateId && g.lang === lang) {
        const ageDays = (Date.now() - new Date(g.at).getTime()) / 86400000;
        if (ageDays < 7) return NextResponse.json({ ok: true, gorsel: g, fromCache: true });
      }
    }

    const template = findTemplate(templateId);

    // Soul ID / maskot referans kontrolü
    let maskotSoulId = null;
    let maskotReferenceImage = null;
    if (template.requiresSoulId) {
      const envSoulId = process.env.MASKOT_SOUL_ID;
      const fileConfig = loadMaskotConfig();
      maskotSoulId = envSoulId || (fileConfig.status === 'ready' ? fileConfig.reference_id : null);
      if (!maskotSoulId) {
        // Soul ID henüz yok → fallback: nano_banana_2_pro + referans görsel
        maskotReferenceImage = MASKOT_REFERENCE_IMG;
      }
    }

    // Platform bazlı format seç (sadece seçili platform için)
    const fmt = resolveFormat(platforms);
    const falSize = fmt.falSize;
    const hfRatio = FAL_TO_HF_RATIO[falSize] || '4:5';

    const prompt = template.buildPrompt(product, lang);
    const negativePrompt = template.buildNegativePrompt ? template.buildNegativePrompt() : undefined;

    // ── KALİTE TIER → MODEL ──────────────────────────────────────────────────
    // Öncelik: body.model (açık model) > body.tier > ayarların varsayılanı (premium).
    // Sağlayıcıya (fal/higgsfield) göre doğru premium model seçilir. Sabit flux-schnell
    // KALDIRILDI (Asaf'ın kalite şikayetinin kökü). Sessiz ucuza düşüş YOK: bilinmeyen
    // tier resolveTier ile GÖRÜNÜR şekilde varsayılana (premium) çekilir.
    const settings = await readSettings();
    const effProvider = (provider || process.env.GEN_IMAGE_PROVIDER || process.env.GEN_PROVIDER || 'fal').toLowerCase();
    const tierReq = body.tier || settings.imageTier || DEFAULT_TIER;
    const { tier: resolvedTier, corrected: tierCorrected } = resolveTier(tierReq);
    if (tierCorrected) console.warn(`[generate/gorsel] Geçersiz tier "${tierReq}" → "${resolvedTier}" (varsayılan premium; ucuza DÜŞÜLMEDİ)`);
    // Maskot/Soul ID akışı özel modele zorlar (higgsfield tarafında); onun dışında tier'dan çöz.
    const chosenModel = body.model || imageModelForTier(resolvedTier, effProvider === 'higgsfield' ? 'higgsfield' : 'fal');

    // Img2img kaynağı: önce ürünün ana görseli (content.gorsel — Hazır İçerik Ekle / manuel /
    // önceki üretim), sonra eski public/products/base.png. Makine yapısı korunur, arka plan/ışık değişir.
    // NOT: yerel dosya yolu verilir; gen.js bunu fal.storage'a yükleyip public URL'e çevirir.
    const currContent = await getContent(slug).catch(() => null);
    const legacyBase = join(process.cwd(), 'public', 'products', slug, 'base.png');
    const refImage = servedToAbs(currContent?.gorsel?.localPath) || (existsSync(legacyBase) ? legacyBase : null);
    const hasUploadedImage = Boolean(refImage);

    const result = await genImage({
      prompt,
      negative_prompt: negativePrompt,
      image_size: falSize,
      aspect_ratio: hfRatio,
      model: chosenModel,
      force: body.force,
      ...(provider && { provider }),
      ...(maskotSoulId && { soul_id: maskotSoulId }),
      ...(maskotReferenceImage && !hasUploadedImage && { reference_image: maskotReferenceImage }),
      ...(hasUploadedImage && !maskotSoulId && { reference_image: refImage }),
    });

    const cdnUrl = result.url;
    if (!cdnUrl) throw new Error('Görsel URL dönmedi');

    // Yerel kopyala — CDN URL'ler expire olur; panel localPath'ten okur
    const { localPath } = await downloadAndSave(cdnUrl, slug, 'gorsel');

    const hasRealImage = Boolean(resolveProductImagePath(product));

    const gorselData = {
      url: cdnUrl,
      localPath: localPath || null,
      template: templateId,
      concept,
      lang,
      platforms,
      format: fmt,
      provider: result.provider,
      model: result.model,
      tier: resolvedTier,
      imageSource: hasUploadedImage ? 'img2img' : (hasRealImage ? 'real' : 'ai-prompt'),
      at: new Date().toISOString(),
    };
    await patchContent(slug, { gorsel: gorselData });

    // Kütüphaneye ekle — her üretim kaydedilir, öncekiler silinmez
    addToLibrary(slug, 'gorsel', gorselData);

    return NextResponse.json({ ok: true, gorsel: gorselData });
  } catch (err) {
    console.error('[generate/gorsel]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
