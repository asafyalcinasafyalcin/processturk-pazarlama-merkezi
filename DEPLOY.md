# Deploy — Pazarlama Komuta Merkezi (Coolify / VPS 72.60.134.242)

Diğer ProcessTürk uygulamaları gibi Coolify üzerinde Docker olarak çalışır.
Üretim motoru: **Higgsfield CLI** (görsel/video/ses/müzik) + **OpenAI** (metin). fal yedek.

## 1. Git repo
Bu klasör (`Processturk_Pazarlama_Merkezi/`) kendi GitHub repo'sudur (Coolify Git'ten build eder):
```bash
cd Processturk_Pazarlama_Merkezi
git init && git add . && git commit -m "Pazarlama Komuta Merkezi"
gh repo create processturk-pazarlama-merkezi --private --source=. --push
```
> `.env.local`, `node_modules`, `.next` `.gitignore`/`.dockerignore`'da — commit edilmez.
> `data/products.json` (katalog) + `content.json` (üretilen içerik) seed olarak commit edilir; kalıcı storage bunları gölgeler.

## 2. Coolify uygulaması
- Coolify → **+ New Resource → Application → Private Git Repository**.
- Repo: `processturk-pazarlama-merkezi`, branch `main`.
- Build pack: **Dockerfile** (standalone Next.js, port **4181**, içinde @higgsfield/cli + ffmpeg + python3).
- Port: `4181`. Domain: örn. `pazarlama.72.60.134.242.nip.io` veya `pazarlama.processturk.com`.

## 3. Ortam değişkenleri (Coolify → Environment Variables)
```
# Motor
GEN_PROVIDER=higgsfield
GEN_TEXT_PROVIDER=openai
HF_TTS_MODEL=elevenlabs

# Higgsfield auth — KRİTİK. Lokaldeki ~/.config/higgsfield/credentials.json içeriğini
# TEK SATIR JSON olarak yapıştır (access_token + refresh_token). Bkz. §5.
HF_CREDENTIALS_JSON={"access_token":"...","refresh_token":"..."}

# OpenAI (metin)
OPENAI_API_KEY=<openai anahtarı>
OPENAI_TEXT_MODEL=gpt-4o-mini

# Meta
META_ACCESS_TOKEN=<uzun ömürlü token>
META_AD_ACCOUNT_ID=676668703597119
META_PAGE_ID=106655158019439
META_IG_BUSINESS_ID=17841445180280753
META_API_VERSION=v21.0
WHATSAPP_NUMBER=905527062723

# İçerik ajanı (LinkedIn/X köprüsü) — VPS adresi
ICERIK_AJANI_URL=https://linkedin.processturk.com

# Ürün verisi container içinde
PRODUCTS_JSON_PATH=/app/data/products.json

# fal yedek (opsiyonel)
FAL_KEY=<fal anahtarı>
FAL_LLM_MODEL=openai/gpt-4o-mini
```

## 4. Kalıcı veri (önemli) — İKİ mount
1. **`/app/data`** → panel state: `products.json`, `content.json` (üretilen içerik + sürümler), `calendar.json`. Container yeniden başlayınca kaybolmasın.
2. **`/app/.hfhome`** → Higgsfield CLI auth + token yenileme. CLI access_token'ı süresi dolunca refresh_token ile yeniler ve **diske yazar**. Bu klasör kalıcı değilse her redeploy `HF_CREDENTIALS_JSON` env'indeki refresh token'ı yeniden kullanır — token rotate olduysa auth kırılır. Bu yüzden `/app/.hfhome` kalıcı storage olmalı.

> İlk boot'ta `docker-entrypoint.sh`, `credentials.json` yoksa `HF_CREDENTIALS_JSON`'dan tohumlar; varsa (kalıcı storage) dokunmaz.

## 5. Higgsfield credentials JSON'unu alma
```bash
# Lokalde Higgsfield'a login olunmuş makinede:
cat ~/.config/higgsfield/credentials.json | python3 -c "import sys,json;print(json.dumps(json.load(sys.stdin)))"
```
Çıktıyı `HF_CREDENTIALS_JSON` env değerine yapıştır. (Refresh token rotate ettiği için ara sıra yenilemek gerekebilir; `/app/.hfhome` kalıcıysa nadiren.)

## 6. Hub'a ekleme
`Processturk_Dashboard` apps-registry'de kart var (`pazarlama`, url `http://127.0.0.1:4181`). VPS domaini belli olunca url'i prod adrese çevir.

## Notlar
- Görsel/video/ses Higgsfield'da üretilir ve Higgsfield-hosted CloudFront URL döner; container'da büyük dosya saklanmaz. ffmpeg render çıktısı `public/renders` → `/api/media` ile servis edilir (kalıcı storage'a gerek yoksa geçici).
- Meta kampanya scripti (`scripts/panel_meta_campaign.py`) bundle; Dockerfile `python3` kurar.
- IG/FB gerçek yayın canlı `@processturk` / "PROCESSTURK" Sayfası'na gider — onay kapısı her gönderide zorunlu.
- Higgsfield kredi tüketir (~görsel 2, video ~22 kredi). Plus plan 1000 kredi/ay.
