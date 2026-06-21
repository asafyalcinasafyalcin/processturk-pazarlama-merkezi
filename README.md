# ProcessTürk Pazarlama Komuta Merkezi

Sosyal medya + reklam + içerik üretimini ve ürün onboarding'ini tek panelden yöneten orkestrasyon uygulaması. Hub'ın (`Processturk_Dashboard`, 4170) **alt paneli**dir.

- **Port:** 4181 · **Stack:** Next.js 15 + React 19 + Tailwind 3.4
- **Başlat:** `./start-local.sh` (dev) veya `./start-local.sh prod`
- **Tek kaynak ürün verisi:** `data/products.json` (paylaşılır; `PRODUCTS_JSON_PATH` ile override).

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

## Tek Giriş Noktası — Komut Yönlendirme (`/api/komut`)

İki bağımsız akışı tek komutla tetikler (ürün: `products.json`, marka: `_core/brands/<BRAND_ID>.json`):

| Komut | `action` | Akış | Varsayılan davranış |
|-------|----------|------|---------------------|
| "bu ürünle paylaşım yap" | `paylasim` | Sosyal: `generate/copy` (+ ops. `generate/video`) → takvim → onay → `publish` | yalnız **metin** üretir (ucuz, dışa kapalı) |
| "bu ürünle reklam çık" | `reklam` | Reklam: `campaign` (Meta plan) → PAUSED kurulum | yalnız **dry-run plan** döner |

```bash
# Paylaşım (metin)            POST /api/komut { "slug":"...", "action":"paylasim" }
# Paylaşım + video            POST /api/komut { "slug":"...", "action":"paylasim", "options":{"video":true} }
# Reklam planı (dry-run)      POST /api/komut { "slug":"...", "action":"reklam" }
# Reklam PAUSED kurulum       POST /api/komut { "slug":"...", "action":"reklam", "options":{"mode":"create"} }
```

**Bağımsızlık:** bir akış çalışırken diğerine dokunulmaz; ikisi de aynı ürün+marka kaynağından
beslenir (aynı ton/kalite). **Güvenlik:** bu uç hiçbir dış gönderim/yayın yapmaz — yayın daima
`/takvim` onayından + `/api/publish`'ten, gerçek kampanya daima Asaf onayından geçer. Mevcut
`generate/copy`, `generate/video`, `campaign` handler'larını in-process yeniden kullanır (mantık tekrarı yok).

### Bilinen sonraki adımlar
- Renk/tema ince ayarı (kullanıcı isteği: şu an fazla koyu).
- Video üzerine marka overlay burn-in (fiyat/logo/CTA) — ✅ İki katman:
  - **Script:** `reklam/scripts/make_video_overlay.py` (şeffaf `templates/video-overlay.html` → Chrome PNG → ffmpeg overlay; statik creative ile tek kaynak config.json). `--lang`, `--no-top` (video zaten markalıysa).
  - **Panele bağlı:** Ürün detayında **"Reklam modu"** → `/api/generate/video` `{ mode:'raw', brandOverlay:true }`. Ham (markasız) klip üretir (`lib/raw-clip.js`), o slug'ın reklam config'ini bulur, marka katmanını (fiyat/başlık/CTA + üst logo) burn-in eder. Ham klipte metin/logo olmadığı için çift-logo çakışması olmaz. Config yoksa ham klip döner.
- IG/TikTok/YouTube gerçek API yayını (işletme hesabı + uygulama onayı).
- Meta gerçek kampanya kurulumu (token + /advideos video upload).
- `data/` durum dosyaları (`content.json`, `calendar.json`) tek kullanıcı/lokal içindir; çok kullanıcı için DB'ye taşınabilir.

## Önemli kural
Birden fazla kişiye gidecek her dış gönderim/kampanya **açık onay** gerektirir (CLAUDE.md "Toplu Gönderim Onayı"). Onay kapısı Faz 3'te panele gömülür.

## Ortam
`.env.example` → `.env.local`. `FAL_KEY`'i `tek .env.local`'dan al (aynı anahtar).
