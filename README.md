# ProcessTürk Pazarlama Komuta Merkezi

Sosyal medya + reklam + içerik üretimini ve ürün onboarding'ini tek panelden yöneten orkestrasyon uygulaması. Hub'ın (`Processturk_Dashboard`, 4170) **alt paneli**dir.

- **Port:** 4181 · **Stack:** Next.js 15 + React 19 + Tailwind 3.4
- **Başlat:** `./start-local.sh` (dev) veya `./start-local.sh prod`
- **Tek kaynak ürün verisi:** `../Meta_Reklam_Sistemi/data/products.json` (paylaşılır; `PRODUCTS_JSON_PATH` ile override).

## Mimari
```
Hub (4170) → Pazarlama Komuta Merkezi (4181)
   ├─ Ürün Onboarding sihirbazı  → products.json
   ├─ İçerik/Reklam motoru (fal.ai)         [Faz 2]
   ├─ İçerik takvimi + onay kapısı          [Faz 3]
   └─ Yayın/Kampanya köprüleri:
        • Video Maker API · Meta scriptleri · icerik-ajani (LinkedIn/X)
```

## Durum
- **Faz 1 (tamam):** Next.js iskelet, 4 adımlı ürün onboarding sihirbazı, ürün listesi, hub kaydı. Onboarding `products.json`'a çekirdek şemayı bozmadan `marketing` bloğu ekleyerek yazar.
- **Faz 2 (tamam):** fal.ai içerik motoru. `/api/generate/copy` (any-llm, 5 varyant × çok dil) + `/api/generate/video` (flux-schnell görsel → seedance-2-fast 9:16 image-to-video). Üretilenler `data/content.json`'a, ürün slug'ına göre saklanır. Ürün detay ekranında önizleme.
- **Faz 3 (tamam):** İçerik takvimi (`/takvim`) + ONAY KAPISI. Akış: taslak → onay (modal teyit) → yayın. `/api/publish` LinkedIn/X'i icerik-ajani API'sine gönderir (gerçek); Instagram/TikTok/YouTube/Facebook için "assisted paket" döner. Onaysız yayın 409 ile bloklanır; PATCH ile `published` zorlanamaz.
- **Faz 4 (tamam):** Meta kampanya planı (`/kampanyalar`). `scripts/panel_meta_campaign.py` products.json + content.json'dan besler, PAUSED kampanya planını (ad set/geo/creative/WhatsApp `[REKLAM:]` link) dry-run üretir. Gerçek kurulum META_* token + video upload + Asaf onayı gerektirir.

### Bilinen sonraki adımlar
- Renk/tema ince ayarı (kullanıcı isteği: şu an fazla koyu).
- Video üzerine marka overlay burn-in (fiyat/logo/CTA) — şu an overlay verisi hazır, yazma işi ileride (ffmpeg/Remotion).
- IG/TikTok/YouTube gerçek API yayını (işletme hesabı + uygulama onayı).
- Meta gerçek kampanya kurulumu (token + /advideos video upload).
- `data/` durum dosyaları (`content.json`, `calendar.json`) tek kullanıcı/lokal içindir; çok kullanıcı için DB'ye taşınabilir.

## Önemli kural
Birden fazla kişiye gidecek her dış gönderim/kampanya **açık onay** gerektirir (CLAUDE.md "Toplu Gönderim Onayı"). Onay kapısı Faz 3'te panele gömülür.

## Ortam
`.env.example` → `.env.local`. `FAL_KEY`'i `../Meta_Reklam_Sistemi/.env.local`'dan al (aynı anahtar).
