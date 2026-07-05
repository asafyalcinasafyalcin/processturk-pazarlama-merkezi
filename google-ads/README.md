# Google Ads Modülü — ProcessTürk

Google Ads yönetimi için **hafif yol**: geliştirici token / OAuth / Manager (MCC) hesabı **gerekmez**.
Claude script + toplu yükleme dosyası üretir; Asaf bunları Google Ads arayüzüne yapıştırır/aktarır.

## Klasör

```
google-ads/
  STRATEJI.md          ← kampanya mimarisi (karma: Search lead + PMax marka + remarketing)
  scripts/             ← Google Ads Scripts (JS) — hesaba yapıştırılıp çalıştırılır
    01-hesap-denetimi.js   ← salt-okunur denetim: kampanya envanteri + dönüşüm durumu + 30g perf.
  editor-uploads/      ← kampanya toplu yükleme dosyaları (Ads Editor / Toplu işlemler → Yüklemeler)
```

## Nasıl çalışır (iki araç)

**1. Google Ads Scripts** — yönetim/optimizasyon/rapor için.
`Araçlar → Toplu işlemler → Komut dosyaları → (+)` → script'i yapıştır → yetkilendir (bir kez) →
Önizle/Çalıştır → "Günlükler" (Logs) çıktısını oku. İstenirse zamanlanır (günlük/haftalık).

**2. Ads Editor / Toplu yükleme** — yeni kampanyaları tek seferde kurmak için.
Claude bir CSV üretir → `Araçlar → Toplu işlemler → Yüklemeler` (veya masaüstü Google Ads Editor) →
içeri aktar → kampanyalar **PAUSED** gelir.

## Onay kapısı

Her kampanya **PAUSED** kurulur; canlıya alma ve bütçe artırımı **yalnız Asaf onayıyla**.
Bu, `../reklam/` (Meta) modülüyle aynı disiplindir.

## Durum

- [x] Modül iskeleti + strateji
- [x] `01-hesap-denetimi.js` (salt-okunur denetim scripti)
- [x] Denetim çıktısı alındı → app kampanyası YOK; 3 eski kampanya (2 VIDEO + 1 PMAX) PAUSED, dokunma
- [x] Dönüşüm temeli teyit: GA4 bağlı, Form (SUBMIT_LEAD_FORM) + Bize Ulaşın + Çağrılar ENABLED
- [x] İlk Search kampanyası hazır → `editor-uploads/PT-Search-EN-Turnkey.md` (+ keywords.csv) — Asaf kuracak, PAUSED
- [ ] Kampanya kuruldu → Asaf önizleme → yayın onayı
- [ ] Yayından önce: canlı hat slug'ları teyit + reklam grubu derin-bağlama
- [ ] Rapor/guardrail script'leri (haftalık CPL, arama terimi/negatif kelime, bütçe koruma)

## İlişkili

- Hedefleme/ürün matrisi (miras): `../reklam/campaigns/HEDEFLEME-MATRISI.md`
- Meta modülü (kardeş kanal): `../reklam/AGENT.md`
- Landing/lead motoru: Kurumsal site Hızlı Teklif (`Processturk_Web_Sitesi/`) veya dolum landing
