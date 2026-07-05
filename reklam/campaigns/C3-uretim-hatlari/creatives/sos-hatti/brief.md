# Anahtar Teslim Sos Üretim Hattı — Kampanya Brief'i (Reklam Seti)

## Hedef
Click-to-WhatsApp ile **komple sos üretim hattı** (anahtar teslim fabrika) için lead üretmek → chatbot (905527062723) karşılar → kapasite/ürün öğrenir → Satın Alma/Teklif akışına devreder.
Ürün: tek makine değil **hatların tamamı** — pişirme kazanı + karıştırma tankı + sıvı dolum + kapaklama + etiketleme + paketleme. Gıda sınıfı 304 paslanmaz. Kurulum + devreye alma + operatör eğitimi dahil.
Fiyat: **proje bazlı** (sabit fiyat verilmez). Reklamda **kapasite** öne çıkar (`[X t/gün]` placeholder — Asaf girecek).
Hedef kitle: sos/ketçap/mayonez/salça üreticisi, fabrika kuran yeni yatırımcı, el üretiminden hatta geçen KOBİ.
Farklılaşma vurgusu: **tek tedarikçi, tek sözleşme — fabrikanın tamamını biz kuruyoruz** (parça parça makine değil). Türk mühendisliği + Avrupa bileşen (Siemens · Schneider · Festo).

## Konsept (2 varyant)
- **A — Komple fabrika / anahtar teslim:** kapsam genişliği + kurulum & eğitim dahil. Ana `config.json`.
- **B — Mühendislik / kalite:** gıda 304 + Avrupa bileşen + "yıllarca üretsin diye tasarlandı". `config-b.json` (`product-b.html`, hero + brands şeridi).
(C "yeni yatırımcı" açısı şimdilik ayrı creative değil; ad-copy.md'de metin olarak var, gerekirse adset eklenir.)

## Varlıklar
- **Config:** `config.json` (Concept A) + `config-b.json` (Concept B) — hedefleme `campaign.adsets` dolu.
- **Metin:** `ad-copy.md` (A/B/C, 4 dil) + WhatsApp prefill (`[REKLAM: C3-sos-hatti]`).
- **Görsel:** ⏳ HENÜZ YOK. `source_image` → `assets/hf-src/sos-hatti.jpg` placeholder.
  - Tek ürün fotoğrafı yok (hat = çok makine). Yol: Asaf'ın hat çizimi/render'ı VEYA Higgsfield ile üretilmiş "komple fabrika hattı" sahnesi.
  - Concept `a-hf`/`b-hf` seçildi → make_product `-hf` / `-b-hf` lifestyle sahne setini üretir (hf_scene.py + make_hf_overlay.py).

## Ad Set yapısı (dil = bölge) — config'ten
Kampanya: **C3 · Anahtar Teslim Sos Hattı** · Hedef: Messaging → WhatsApp. Her dilde A + B iki adset.

| Ad Set | Dil | Hedef ülkeler | Concept |
|--------|-----|----------------|---------|
| AS-EN | İngilizce | Nijerya, Gana, Kenya | a-hf + b-hf |
| AS-FR | Fransızca | Cezayir, Fas, Tunus, Senegal, Fildişi Sahili | a-hf + b-hf |
| AS-AR | Arapça | Suudi Arabistan, BAE, Katar, Kuveyt, Mısır | a-hf + b-hf |
| AS-RU | Rusça | Azerbaycan, Kazakistan, Özbekistan | a-hf + b-hf |

Kitle: 28–58, gıda üretimi/fabrika yatırımı sinyalleri; sos/soslu ürün üreticisi, yatırımcı segment.

## Bütçe & test
Düşük günlük bütçeyle başla; 4–5 gün öğrenme (hat = yüksek bilet → lead daha az/pahalı, sabırlı ölç).
Metrik: **CPL = harcama / WhatsApp sohbet başlama**, ardından **nitelikli lead** (gerçek kapasite/bütçe söyleyen).
En düşük nitelikli-CPL'li dil+concept ölçeklenir.

## Ölçüm
Lead'ler `[REKLAM: C3-sos-hatti]` etiketiyle gelir; `[ref: sos-hatti-{a|b}-{lang}]` ad set atfını taşır.
Huni: gösterim → tık → WhatsApp → nitelikli görüşme → teklif → satış.

## Onay kapısı
Yayından önce Asaf'a sun: görseller + copy + ad set/ülke + günlük bütçe. **Açık onay olmadan launch yok** (toplu/dış mesaj kuralı).

## ✅ Kararlar (Asaf, 2026-06-28)
1. **Görsel:** fal.ai genel sahnesi (gerçek hat fotoğrafı verilmedi). İlk tur "ketçap hattı gibi + makineler gerçek değil" geri bildirimi → `flux-pro/v1.1` + fotoğrafik prompt, **mayonez ağırlıklı + gerçek dolum/üretim makineleri** ile yeniden üretildi. Hero sahne = Aday 2 (tank + çok-nozullü dolum + kontrol panosu). Aday 1 (dolum yakın plan) `_cand1.png` olarak yedek.
2. **Kapasite:** 500 / 1000 / 1500 L/saat (3 model) → görselde aralık olarak **500–1500 L/h** (kırmızı anchor) basıldı.
3. **Marka bileşen:** Siemens · Schneider · Festo **onaylandı** (Concept B'de kalıyor).
4. **Konsept:** sadece **Concept B** (mühendislik/kalite). Concept A creative'leri ve adset'leri kaldırıldı; `config.json` adsets = b-hf × 4 dil.

## ✅ GERÇEK VARLIKLAR (Asaf yükledi 2026-06-28, `assets/hf-src/`)
fal.ai genel sahnesi BIRAKILDI; gerçek görüntüye geçildi:
- **Foto:** `dolum-makinasi-foto1.png` (gerçek lineer pistonlu dolum makinesi, navy zemin = markayla birebir) → **statiklerin sahnesi**. `foto2` (mühendis+hat) yedek.
- **Video:** `dolum-makinasi-1.mp4` (dolum yakın plan) + `dolum-makinasi-2.mp4` (komple kabinli makine). İkisi de **720×1280 / 9:16 / 10sn / 24fps** — Reels/Story'ye birebir.

## 📦 ÜRETİLEN CREATIVE'LER (Concept B)
- **Statik (gerçek foto1):** `sos-hatti-anahtar-teslim-b-hf-{en,fr,ar,ru}-{feed,story,square}.png` → 12 adet.
- **Video (gerçek footage + marka overlay):** `video-hat-{en,fr,ar,ru}.mp4` (video1 dolum yakın plan = kremamsı mayonez, 4 dil). Overlay = `make_video_overlay.py` (config-b dil bloğu; `name` alanı yalnız video başlığı için eklendi, statik şablon `hero` kullanır).
- **NOT:** video2 (`dolum-makinasi-2.mp4`) içeriği mayonez değil **sıvı** doldurduğu için sos hattından çıkarıldı → **C1 `sivi-dolum-hat`** ürün reklamına taşındı (`video-dolum-{en,fr,ar,ru}.mp4`, "Liquid Filling Line · 28.750 USD'den"). Asaf kararı 2026-06-28.
- Kapasite tüm creative'lerde **500–1500 L/h** (4 dil), marka şeridi Siemens·Schneider·Festo.

## 🎬 KONVEYÖR VİDEOSU (image-to-video, 2026-06-28)
Asaf'ın "dolum kafası yok + tek renk + derinlikli hat" isteğiyle: beyaz mayonez konveyör 9:16 still → **Seedance 2.0 Fast image-to-video** (5sn, bozulma yok). Araç: `animate-clip.mjs` (kök; panelin fal.js motorunu CLI'dan kullanır).
- **Temiz (sosyal):** `konveyor-mayonez-SOSYAL.mp4`
- **Markalı (reklam):** `video-konveyor-{en,fr,ar,ru}.mp4`

## 📱 SOSYAL PAYLAŞIM SETİ (`sosyal-paylasim/`)
İşlenmemiş görseller + TR/EN başlıklar (kurumsal dil): 01 konveyör video 9:16, 02 konveyör dikey, 03 konveyör feed 4:5, 04 gerçek dolum makinesi fotosu + `paylasim-metinleri.md`.

## ✅ META KAMPANYASI KURULDU (PAUSED · 2026-06-28)
- Kampanya `120247627041800674` · 4 ad set (EN→NG/GH/KE · FR→DZ/MA/TN/SN/CI · AR→SA/AE/QA/KW/EG · RU→AZ/KZ/UZ) · ₺50/gün/ad set · CTWA, statik b-hf creative'ler.
- HEPSİ PAUSED — yayın Asaf'ın Ads Manager onayında. Hesap: act_676668703597119.

## ⏳ Kalan
- Asaf Ads Manager'da inceleyip yayınlar (harcama onayı).
- C1 `sivi-dolum-hat` ayrı kampanya (ana varlık video; create_meta_campaign statik-only → video manuel yükleme ya da statik creative üretimi gerekir).
