# Takip & Ölçüm Altyapısı — Uzun Vadeli Veri Akışı (blueprint)

> Amaç: her reklamın gösterimden **satışa** kadar izlenebildiği, konsept/dil/ürün kırılımıyla sağlıklı
> analiz yapılabilen bir ölçüm sistemi. Bu doküman **tasarımdır**; satış geri-beslemesi chatbot/CRM
> hazır olunca bağlanır (Asaf tarafı). Reklam üretimi/raporlama tarafı HAZIR.

## 1) Huni & KPI'lar
| Aşama | Kaynak | Metrik |
|------|--------|--------|
| Gösterim → Tık | Meta | impressions, CTR, CPM |
| **Sohbet başlama** | Meta (CONVERSATIONS) | messaging_conversation_started · **CPL = harcama/sohbet** |
| Nitelikli lead | Chatbot → CRM (Bitrix24) | gerçek işletme mi? (ref ile eşleşir) |
| Teklif | CRM | teklif sayısı / lead |
| **Satış** | CRM "deal won" | satış adedi, ciro, **maliyet/satış, ROAS** |

**Kıyas (hesap geçmişi, `meta_report.py`):** Afrika EN/FR mesajlaşma **~2,5–3 TRY/sohbet**; Arabistan ~10 TRY.
Granül A/B hedefi: bu bandı yakala/aş; düşük CPL'li konsept kazanır.

## 2) Atıf zinciri (uçtan uca izleme)
```
Reklam (ad set = konsept/dil)
  └─ WhatsApp ön-dolu mesaj:  "... [REKLAM: C1-granul] [ref: granul-dolum-a-en]"
       • [REKLAM: C1-granul] → chatbot ÜRÜN akışını başlatır (değişmez)
       • [ref: <slug>-<konsept>-<dil>] → CRM'e ATIF (hangi reklam/konsept/dil)
  └─ ctwa_clid (WhatsApp tık-id, referral.source_id) → kesin reklam atıfı (ileri seviye, opsiyonel)
Chatbot → Bitrix24 lead'ine ref + ctwa_clid yazar
CRM "deal won" → offline/CAPI conversion → Meta dataset → maliyet/satış + optimizasyon
```
Ref şeması `create_meta_campaign.py` `build_unit`'te otomatik üretilir (her reklam benzersiz).

## 3) Dataset rolleri (hesapta MEVCUT)
| Dataset | ID | Rol |
|--------|----|-----|
| ProcessTürk Cevrımdısı Olaylar (offline) | `574101085357676` | **Satış/teklif** geri-yükleme (lead→satış) |
| PROCESSTURK Event Data (pixel) | `1013107747559832` | Web olayları (site ziyaret/form) — gerekirse |
| Processtürk | `683041987846396` | yedek/diğer |

## 4) Satış geri-beslemesi — Make.com blueprint (SONRA, chatbot hazır olunca)
Tetik: **Bitrix24 "deal won"** → Make senaryosu →
- Lead kaydından **ref** + telefon/e-posta (hash) + **ctwa_clid** çek
- Meta **Conversions API / Offline Conversions** event'i gönder → dataset `574101085357676`
  - event_name: `Purchase` (ya da `Lead`/`Qualified` ara aşamalar)
  - custom_data: value (ciro), currency `TRY`, ref (atıf)
  - matching: phone/email hash + ctwa_clid
→ Meta hangi **reklam/konseptin gerçek satış** getirdiğini öğrenir → maliyet/satış & ROAS + optimizasyon.

**Not:** Make'in `facebook-ads-cm` reklam *oluşturamaz* ama **Conversions/Offline API** çağrısı (HTTP modülü)
ile bu geri-besleme yapılabilir. Org Processturk / Core plan ücretsiz katmanı yeterli. Kurulum chatbot
ref'i CRM'e yazmaya başlayınca devreye alınır.

## 5) Raporlama (HAZIR — `scripts/meta_report.py`)
- Meta Insights (READ-ONLY) → `data/meta_insights.csv` (gün+ad bazında idempotent zaman serisi).
- Konsept (A/B) başına harcama/gösterim/sohbet/**CPL** özeti.
- Komut: `python3 scripts/meta_report.py --preset last_7d` (ya da `--since/--until`).
- Günlük çalıştır (ileride launchd/cron) → uzun vadeli trend.

## 6) Açık işler (Asaf tarafı, yayın öncesi/sonrası)
- [ ] Chatbot, prefill'deki **`[ref: ...]`** kodunu okuyup CRM lead'ine yazsın (ürün rota etiketi `[REKLAM: ...]` aynı kalır).
- [ ] (Opsiyonel) chatbot `ctwa_clid`'i (WhatsApp referral) yakalayıp kaydetsin → kesin atıf.
- [ ] CRM "deal won" → Make → Offline/CAPI event (yukarıdaki blueprint).
- [ ] `meta_report.py` günlük otomasyon (cron/launchd).
