# Salça & Domates İşleme Hattı — Kampanya Brief'i (Reklam Seti)

## Hedef
Click-to-WhatsApp ile **salça/domates işleme hattı** (yıkama→kırma→pulper/refiner→vakum evaporasyon→pastörizasyon→aseptik/tenekeli dolum) için lead üretmek → chatbot (905527062723) karşılar → kapasite/brix/ülke öğrenir → Satın Alma/Teklif akışına devreder.
Ürün: tek makine değil **hattın tamamı** — kabul/tartım + yıkama&ayıklama + kırma&ön ısıtma (hot/cold-break) + pulper&refiner + vakum evaporasyon + pastörizasyon + aseptik/teneke/kavanoz dolum. Ürün temas AISI 304/316 paslanmaz. Kurulum + devreye alma + operatör eğitimi dahil (kaynak: `data/products.json` kaydı `WEB-SALCA-DOMATES-ISLEME-HATTI`).
Fiyat: **proje bazlı** (`priceConfirmed=false`, sabit fiyat verilmez, rakam yazılmaz). Reklamda **kapasite** öne çıkar: **6–50 ton/gün** (proje bazlı daha yüksek), brix hedefi 28–36.
Hedef kitle (üründen doğrulanmış): yeni domates/salça yatırımcısı, mevcut konserve fabrikasını modernize eden, salça ihracatçısı & fason üretici, kooperatif/tarımsal işletme.
Farklılaşma vurgusu: **tek tedarikçi, tek sözleşme — hattın tamamını biz kuruyoruz** (parça parça makine değil). Türk mühendisliği + Avrupa bileşen (Siemens · Schneider · Festo).

## Konsept (tek konsept — B)
- **B — Mühendislik / kalite:** gıda sınıfı 304/316 + Avrupa bileşen + "yıllarca üretsin diye tasarlandı". Tek `config.json` (`variant: b`, `template: product-b.html`; hf-scene render'ı için `product-b-hf.html`'e de uyumlu — hero/brands/badges/origin/sub/cta şeması).
- (A "komple hat/anahtar teslim" ve C "yeni yatırımcı/modernizasyon" açıları ayrı creative değil; `ad-copy.md`'de 3 metin varyantı olarak mevcut — sos-hatti hattı formatıyla birebir.)

## Varlıklar
- **Config:** `config.json` — hedefleme `campaign.adsets` dolu (EN→NG/GH/KE · FR→DZ/MA/TN/SN/CI · AR→SA/AE/QA/KW/EG · RU→AZ/KZ/UZ, hepsi concept `b-hf`). `languages.{en,fr,ar,ru}` blokları bu turda dolduruldu (aşağıya bakınız).
- **Metin:** `ad-copy.md` (A/B/C, 4 dil) + WhatsApp prefill (`[REKLAM: C3-salca-domates]`) — TASLAK, bu turda üretildi.
- **Görsel:** ⏳ HENÜZ YOK / işlenmemiş. `source_image` → gerçek yüklenmiş foto (`data/uploads/salca-domates-isleme-hatti-gorsel-1783208638124-0sp6.jpg`, salça hattı web sitesi görseliyle aynı). Cutout/props/sahne üretimi (fal.ai / Higgsfield) ve `make_product.py` / `make_hf_overlay.py` render'ı görsel alt ajanının işi — bu turda yapılmadı.

## Ad Set yapısı (dil = bölge) — config'ten
Kampanya: **C3 · Salça & Domates İşleme Hattı** · Hedef: Messaging → WhatsApp. Tek konsept (B) × 4 dil.

| Ad Set | Dil | Hedef ülkeler | Concept |
|--------|-----|----------------|---------|
| AS-EN | İngilizce | Nijerya, Gana, Kenya | b-hf |
| AS-FR | Fransızca | Cezayir, Fas, Tunus, Senegal, Fildişi Sahili | b-hf |
| AS-AR | Arapça | Suudi Arabistan, BAE, Katar, Kuveyt, Mısır | b-hf |
| AS-RU | Rusça | Azerbaycan, Kazakistan, Özbekistan | b-hf |

Kitle: gıda üretimi/fabrika yatırımı sinyalleri; domates/salça üreticisi, konserve fabrikası sahibi, ihracatçı/fason üretici, tarımsal kooperatif segmenti.

## Bölge üslup notu (bu turda uygulandı)
- **EN/FR (Afrika — Nijerya/Gana/Kenya, Cezayir/Fas/Tunus/Senegal/Fildişi Sahili):** net, pratik, güven veren ton (`francophone-africa-guide.md`) — doğrudan kapasite + malzeme + CE, agresif satış dili yok.
- **AR (Körfez — SA/AE/QA/KW/EG):** premium, kalite ve hijyen vurgulu, saygılı/diplomatik ton (`gulf-cultural-guide.md`) — doğrudan fiyat baskısı yok, "hijyenik dolum" (aseptik/tenekeli dolum sürecinden doğrulanmış) vurgusu eklendi.
- **RU (Orta Asya — AZ/KZ/UZ):** mühendislik/kapasite odaklı ton.

## Bütçe & test
Düşük günlük bütçeyle başla; 4–5 gün öğrenme (hat = yüksek bilet → lead daha az/pahalı, sabırlı ölç).
Metrik: **CPL = harcama / WhatsApp sohbet başlama**, ardından **nitelikli lead** (gerçek kapasite/brix/bütçe söyleyen).

## Ölçüm
Lead'ler `[REKLAM: C3-salca-domates]` etiketiyle gelir; `[ref: salca-domates-b-{lang}]` ad set atfını taşır.
Huni: gösterim → tık → WhatsApp → nitelikli görüşme → teklif → satış.

## Onay kapısı
Yayından önce Asaf'a sun: görseller + copy + ad set/ülke + günlük bütçe. **Açık onay olmadan launch yok** (toplu/dış mesaj kuralı). Meta kampanyası bu turda KURULMADI.

## ⏳ Kalan
- Görsel alt ajanı: cutout/props/sahne üretimi + `make_product.py`/`make_hf_overlay.py` render (12 statik + varsa video).
- `scripts/create_meta_campaign.py` ile kampanya kurulumu (PAUSED) — yayın Asaf onayına bağlı.
- Asaf'ın ad-copy + görsel + hedefleme onayı.
