# Skill: Reklam Üretimi (Copy + Creative)

Meta/TikTok Click-to-WhatsApp reklamları için copy ve görsel brief üretir.

## Ne zaman kullan
Bir kampanya teması için reklam metni + creative brief gerektiğinde.

## 5 SANİYE KURALI (zorunlu)
Her reklam ilk bakışta/ilk 3 saniyede üç şeyi vermeli:
1. **NE** — ne satıyoruz (ürün/sonuç, somut).
2. **KİME** — hedef ("baharat paketleyen", "sos üretmek isteyen").
3. **TEK fayda** — bir rakam veya tek sonuç (fiyat / kapasite / teslim süresi).

Test: Görsele 5 sn bakan biri "bu ne, bana mı, neden" sorularına cevap bulamıyorsa yeniden yaz.

## Copy formülü
- **Primary text:** kanca cümlesi (soru/komut) → somut fayda + rakam → "WhatsApp'tan bugün teklif al" daveti. 2–4 cümle.
- **Headline (≤7 kelime):** ürün + rakam ("Granül dolum — 900$'dan başlar").
- **Description (≤1 satır):** güven sinyali (304 paslanmaz · kurulum · teslim süresi).
- **CTA:** "WhatsApp'ı gönder / Send message".

Her temada **3–5 varyant** üret, farklı kanca: (A) fiyat, (B) hız/sonuç, (C) yeni yatırımcı/duygu, (D) sorun-çözüm, (E) sosyal kanıt.

## Marka sesi
- Kaynak: `../../_core/brand-voice/PROCESSTURK_KURUMSAL_ILETISIM_DILI.md`.
- Pozitif, çözüm odaklı, mühendislik güveni. "Fikrini söyle, sistemini kuralım" çatısı.
- YAPMA: "en ucuz / en iyi / lider" boş slogan; azarlayan ton ("çoğu yatırımcı yanlış yapar"); jargon yığını.
- Hazır makinelerde net/satışçı dil OK (fiyat ver, hızlı kapanış). Üretim hatlarında danışmanlık dili (mühendis görüşmesine davet, direkt fiyat değil).

## Dil
- Birincil TR. Hedef pazara göre AR (Cezayir/Mısır/Körfez), EN (Afrika/genel), gerekirse FR/RU.
- Önce TR varyantlarını A/B test et; kazanan kancayı diğer dillere taşı.

## Creative brief (Canva/AI üretimi için)
- Format: 1:1 (feed) + 9:16 (story/reels/tiktok).
- Görsel: koyu zeminde gerçek/AI makine görseli — generic el sıkışma/stok ofis YOK.
- Renk: Navy `#071739` zemin, Red `#FF3255` yalnız CTA + rakam (≤%5). Logo beyaz, köşede.
- Font: başlık Montserrat (600/700), alt Inter, rakam JetBrains Mono.
- Overlay: tek büyük rakam + tek cümle başlık + CTA rozeti. Kalabalık yapma.
- Görsel üretimi Canva MCP veya AI ile; gerçek ürün medyası varsa o önceliklidir.

## Description alanı — site + WhatsApp'a yönlendirsin (Asaf talebi, 2026-07-07)
Her dilin `description` alanı (config'te açık yazılmazsa script badge'lere düşer) HER ZAMAN hem web sitesini
hem WhatsApp'ı işaret etsin, örn. EN: "See more at processturk.com or message us on WhatsApp". Görselin
üzerine basılmaz (yalnız Meta ad'ın description metin alanıdır), o yüzden görsel yeniden üretmeyi gerektirmez —
sadece config'e `description` alanı eklenir.

## Fiyat (tek kaynak)
Reklamdaki fiyat **`../data/products.json`**'dan gelir (Excel'den `scripts/import_prices.py` ile üretilir).
İfade: **"...'den başlar"** (Starting from / À partir de / تبدأ من / От) + resmi satış fiyatı.
Fiyatı asla elle uydurma; Excel güncellenince script'i yeniden çalıştır ve config price_num'ları güncelle.

## Üretim & ölçüm standardı (Meta API — zorunlu)
Her reklam `scripts/create_meta_campaign.py` ile kurulur (PAUSED; yayını Asaf başlatır). Standart:
- **3 format creative** (placement'a göre): 4:5 feed · 9:16 story/reels · 1:1 square. `make_product.py`
  config `sizes: ["feed","story","square"]` ile üretir.
  ⛔ **CTWA'da (Click-to-WhatsApp) çok-format `asset_feed_spec` KULLANILMAZ** — Meta
  `is_click_to_message=false` yapar, tıklama tarayıcıya düşer, lead gelmez. CTWA reklamı **tek görsel**
  `object_story_spec.link_data` + `call_to_action {type: WHATSAPP_MESSAGE}` ile kurulur (script bunu
  doğru yapar). `asset_feed_spec` + `asset_customization_rules` yalnız **CTWA olmayan** (link/trafik,
  form) kampanyalarda geçerlidir; 3 format orada devreye girer.
- **IG kimliği:** `.env.local` `META_INSTAGRAM_ID` (sayfaya bağlı IG) — IG yerleşimleri için şart.
- **Zengin atıf:** WhatsApp prefill = ürün rota etiketi `[REKLAM: Cx-...]` (chatbot okur, değişmez) **+**
  `[ref: <slug>-<konsept>-<dil>]` (CRM atıfı). Script otomatik üretir.
- **Sabit kitle / temiz A/B:** `advantage_audience:0`; ad-set bazlı bütçe (CBO kapalı); `bid_strategy
  LOWEST_COST_WITHOUT_CAP`; opt `CONVERSATIONS`, dest `WHATSAPP`.
- **Standart geliştirmeler:** Meta toplu API opt-out'u kaldırdı; marka korumasını açık placement görselleri
  sağlar; tam kapatma gerekirse Ads Manager'da yayından önce reklam bazında.
- **A/B:** `--ab <dil>` → aynı geo'da Concept A (fiyat) vs B (kalite) 2 ad set; kazananı diğer dile taşı.
- **Raporlama:** `scripts/meta_report.py` → `../data/meta_insights.csv` (gün+ad, idempotent) + konsept CPL.
  Kıyas: Afrika EN/FR mesajlaşma ~2,5–3 TRY/sohbet. Satış geri-beslemesi: `campaigns/TAKIP-ALTYAPISI.md`.

## AI kredi tasarrufu (Higgsfield/fal.ai — zorunlu, 2026-07-07)
Yeni bir ürün için Higgsfield sahne (`hf_scene.py`) veya fal cutout (`make_product.py`) ÇALIŞTIRMADAN önce
`higgsfield account status` ile kredi kontrolü ucuz bir ön-adım. Üretim SIRALI ve KADEMELİ yapılır — hepsini
tek seferde basma:
1. Önce **1 format, 1 dil** üret (`--ratios feed` / `--sizes feed`, sadece `en`). Asaf/operatör gözle onaylasın.
2. Onay sonrası diğer formatlara (story/square) ve dillere (fr/ar/ru) geç.
Gerekçe: iki servis de (Higgsfield + fal.ai) aynı anda bakiyesiz kalabiliyor (2026-07-07'de yaşandı) — büyük
partiyi baştan basıp kalite/konsept yanlış çıkarsa kredi boşa gider. `make_hf_overlay.py` (headless Chrome
render) kredi harcamaz — sahne görseli hazır olduktan sonra format/dil çoğaltmak ücretsizdir, sadece AI
sahne/cutout üretimi (Higgsfield/fal çağrısı) kısıtlı tutulur.

## Hassas veri
Gerçek müşteri adı + fiyat/hacim kombinasyonu, şirket finansalları kamuya açık reklamda kullanılmaz.

## Çıktı
`campaigns/Cx-*/ad-copy.md` + `creative-brief.md`. Taslak olarak işaretle; yayın Asaf onayına bağlı.
