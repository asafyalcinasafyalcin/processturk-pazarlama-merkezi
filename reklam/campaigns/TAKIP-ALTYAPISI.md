# Takip & Ölçüm Altyapısı — Uzun Vadeli Veri Akışı (blueprint)

> Amaç: her reklamın gösterimden **satışa** kadar izlenebildiği, konsept/dil/ürün kırılımıyla sağlıklı
> analiz yapılabilen bir ölçüm sistemi.
>
> **Durum (2026-07-18):** gönderici artık HAZIR → `scripts/capi_satis_gonder.py` (Make.com'a gerek
> kalmadı, aşağıda §4). Kalan tek adım: CRM'den satış kaydını çıkarıp bu script'e vermek + ilk
> `--test-event-code` doğrulaması. Ölçüm yöntemi/kuralları: `reklam-olcum` yeteneği.
>
> ⚠️ **CRM = Pipely** (`pipely.processturk.com`). Bu dokümanda geçen **Bitrix24 ARTIK KULLANILMIYOR**;
> eski adlandırma tarihsel not olarak bırakıldı, yeni iş Pipely üzerinden yapılır.

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

## 4) Satış geri-beslemesi — ✅ GÖNDERİCİ HAZIR (`scripts/capi_satis_gonder.py`)

Make.com'a **gerek kalmadı** — geri-besleme kendi script'imizle yapılıyor (bir bağımlılık ve bir
aylık ücret eksildi; ayrıca dedup/izin/hash disiplini kodda denetlenebiliyor).

```bash
# 1) KURU çalışma — hiçbir istek atılmaz, ne gideceğini gösterir
python3 scripts/capi_satis_gonder.py --girdi satislar.csv --izin-alani izin

# 2) TEST — Events Manager > Test Events'te görünür, kalıcı veriyi KİRLETMEZ
python3 scripts/capi_satis_gonder.py --girdi satislar.csv --izin-alani izin \
        --test-event-code TESTXXXXX --apply

# 3) GERÇEK gönderim (yalnız 2. adım doğrulandıktan sonra)
python3 scripts/capi_satis_gonder.py --girdi satislar.csv --izin-alani izin --apply
```

Girdi sütunları: `lead_id, olay_zamani, deger, para_birimi, telefon|eposta|ctwa_clid, izin, ref`.
Script şunları garanti eder:
- **Dedup çift katman:** `event_id = lead_id` (Meta tarafı) + yerel gönderim defteri
  `data/capi_gonderim.csv` (aynı olay ikinci kez gönderilmez) → *geç gelen CRM güncellemesi
  ikinci satış yaratmaz*.
- **KVKK:** telefon/e-posta yalnız normalize + SHA-256; ham kimlik ne istekte ne defterde tutulur.
  `--izin-alani` ile izinsiz kayıt gönderilmez. Hash izin yerine geçmez.
- **Telefon normalize:** `0532…`/`532…` → `90532…` (yanlış ülke kodu eşleşmeyi sessizce sıfırlar).
- **ctwa_clid hash'lenmez** (Meta ham bekler) ve varsa `action_source: business_messaging` kullanılır.
- 7 günden eski olay ve çok para birimli girdi **uyarılır** (Meta bunları toplamaz).

Dataset: `574101085357676` → `.env.local` içinde `META_DATASET_ID`.
→ Meta hangi **reklam/konseptin gerçek satış** getirdiğini öğrenir → maliyet/satış & ROAS + optimizasyon.

## 5) Raporlama (HAZIR — `scripts/meta_report.py`)
- Meta Insights (READ-ONLY) → `data/meta_insights.csv` (gün+ad bazında idempotent zaman serisi).
- Konsept (A/B) başına harcama/gösterim/sohbet/**CPL** özeti.
- Komut: `python3 scripts/meta_report.py --preset last_7d` (ya da `--since/--until`).
- Günlük çalıştır (ileride launchd/cron) → uzun vadeli trend.

## 6) Açık işler

**✅ Kapatılanlar (2026-07-18)**
- [x] CRM "satıldı" → Offline/CAPI göndericisi → `scripts/capi_satis_gonder.py` (Make.com iptal).
- [x] `ctwa_clid` yakalama → WhatsApp webhook `referral.ctwa_clid` alanından okunuyor (§7).
- [x] Raporlama otomasyonu → `scripts/haftalik_rapor.sh` (cron satırı README'de; kurulum Asaf'ta).
- [x] Ölçüm doğruluk kuralları → `reklam-olcum` yeteneği (karşılaştırılabilirlik kapısı, dedup, MER).

**Kalan (Asaf tarafı — canlı erişim gerektirir)**
- [ ] Pipely'den satış kaydını CSV'ye çıkaran sorgu/uç (script'in girdi şemasına göre).
- [ ] İlk `--test-event-code` doğrulaması → Events Manager > Test Events'te olay görünüyor mu.
- [ ] `.env.local`'a `META_DATASET_ID=574101085357676` ekle.
- [ ] `messaging_channel` alan adını Events Manager'da teyit et (kodda `# DOĞRULANMALI` işaretli).
- [ ] İlk gerçek gönderimden ~72 saat sonra: ROAS/maliyet-başına-satış okunabiliyor mu; okunuyorsa
      bütçe kaydırma kararı artık CPL'e değil **buna** dayanır.
