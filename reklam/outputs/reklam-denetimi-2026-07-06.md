# Reklam Hesap Denetimi — ProcessTürk

**Tarih:** 2026-07-06 · **Kaynak:** Google Ads API (v21) + Meta Insights API (canlı çekim) · **Soru:** "Hiç ziyaretçi gelmiyor, Google reklamını artırmamız mı lazım?"

## Kısa cevap

**Hayır — sorun bütçe değil, hiçbir reklamın gerçekten yayınlanmaması.** Bütçe artırmak tek ziyaretçi getirmez. Meta'nın 5 kampanyası da duraklatılmış; tek açık Google kampanyası ise teklifi düşük olduğu için ₺0 harcıyor (gösterimlerin %90'ını rakiplere kaptırıyor, %0'ını bütçeden). Trafik için gereken: **doğru kampanyaları açmak + tek açık kampanyanın teklifini düzeltmek.**

---

## 1. Meta (Facebook/Instagram) — hesap: ProcessTürk I 2025 (TRY)

Son 90 gün toplam: **₺169 harcama · 3.710 gösterim · 47 tık · 8 WhatsApp sohbeti** → **~₺21 / sohbet (lead).** Bu, elimizdeki **en ucuz lead kanalı.** Ama şu an **5 kampanyanın hepsi DURAKLATILMIŞ → sıfır yayın.**

| Kampanya | Hedef | Durum | Not |
|---|---|---|---|
| C1 · sivi-dolum-hat · CTWA | WhatsApp sohbeti | ⏸ Duraklatılmış | 30g'de ₺94 → 4 sohbet (**CPL ₺23,5**) — kanıtlı çalışıyor |
| C1 · granul-dolum · CTWA | WhatsApp sohbeti | ⏸ Duraklatılmış | — |
| C1 · sos-hatti-anahtar-teslim · CTWA | WhatsApp sohbeti | ⏸ Duraklatılmış | — |
| Instagram gönderisi (boost) | Link tıklama | ⏸ Duraklatılmış | Marka/etkileşim |
| Potansiyel Müşteri Kampanyası.01 | Lead formu | ⏸ Duraklatılmış | ₺50/gün bütçe tanımlı |

## 2. Google Ads — hesap: 3256257946 (TRY)

**6 kampanya · sadece 1'i açık, o da ₺0 harcıyor.**

| Kampanya | Durum | Bütçe | Sorun |
|---|---|---|---|
| **PT-Search-EN-Turnkey** | ✅ Açık (ELIGIBLE) | ₺100/gün | **Teklif düşük:** MANUAL_CPC, gösterimlerin **%90'ı sıra/teklif yüzünden kayıp, %0'ı bütçe**. Reklamlar ONAYLI, İngilizce niş B2B kelimeler (tomato paste / ketchup production line) |
| PROCESSTÜRK | ⏸ Duraklatılmış | ₺33/gün | Türkçe/marka — hacim potansiyeli yüksek |
| AKTİTANYUM | ⏸ Duraklatılmış | ₺33/gün | Türkçe/marka |
| PROCESSTÜRK Youtube 08.01.2024 | ⏸ Duraklatılmış | ₺30/gün | Video |
| AKTITANYUM Youtube 09.01.2024 | ⏸ Duraklatılmış | ₺30/gün | Video |
| PROCESSTÜRK SÜT REKLAMI | ⏸ Duraklatılmış | ₺250/gün | ⚠️ **Reddedilmiş asset grubu var** — açılsa da yayınlanmaz, önce kreatif düzeltilmeli |

**Kritik tanı — PT-Search-EN-Turnkey neden ₺0 harcıyor:**
- Teklif stratejisi: **MANUAL_CPC** (elle, düşük)
- Bütçe yüzünden kayıp gösterim: **%0** ← bütçe bitmiyor
- Sıra/teklif yüzünden kayıp gösterim: **%90** ← teklif açık artırmayı kazanmıyor
- → Bütçeyi ₺100 → ₺500 yapmak **hiçbir şey değiştirmez.** Çözüm teklifi yükseltmek/otomatik stratejiye geçmek.

---

## 3. Öncelikli Aksiyon Planı

Bütçe darboğaz DEĞİL (hesap 90 günde toplam ~₺169 Meta + ₺0 Google harcamış). Darboğaz: kampanyalar kapalı veya yanlış teklifli. Sıra:

### P1 — Meta CTWA'yı yeniden aç (en hızlı, kanıtlı, en ucuz)
- **Ne:** `C1 · sivi-dolum-hat · CTWA` kampanyasını yeniden aktifleştir (geçmişte ₺23,5 CPL verdi).
- **Bütçe önerisi:** ₺100–150/gün (kontrollü başlangıç).
- **Beklenen:** geçmiş performansa göre ~₺20–25/WhatsApp lead. Gün içinde sohbet başlar.
- **Onay gerekli** (canlı yayın + harcama).

### P2 — İngilizce Search kampanyasının teklifini düzelt
- **Ne:** `PT-Search-EN-Turnkey` → MANUAL_CPC yerine **"Tıklamayı En Üst Düzeye Çıkar" (Maximize Clicks)** veya CPC tekliflerini belirgin yükselt.
- **Beklenen:** %90 rank kaybı kapanır, mevcut ONAYLI reklamlar gösterilmeye başlar. NOT: İngilizce niş B2B kelimeler düşük hacimli → trafik ölçülü olur, ama bedava değeri açığa çıkar.
- **Onay gerekli** (teklif/strateji değişimi).

### P3 — Türkçe/marka Google kampanyasını aç (PROCESSTÜRK)
- İngilizce niş aramadan çok daha fazla hacim. Önce reklam/kelime durumu kontrol edilmeli, sonra bütçe+teklifle açılır.

### P4 — SÜT REKLAMI'nı düzelt veya bırak
- Reddedilmiş asset grubu var; açmadan önce kreatif düzeltmesi gerekir. Düşük öncelik.

### Paralel (reklamdan bağımsız) — organik/SEO
- Site yeni, organik trafik ~0. `seo-altyapisi` pilotu kuruldu; uzun vadeli ücretsiz trafik için o ayrı hat.

---

## 4. Guardrail

Hiçbir kampanya/bütçe/teklif **Asaf'ın açık onayı olmadan** değiştirilmez (mevcut kural: PAUSED + onay). Bu rapor salt okunurdur. Uygulama `google-ads` ve `sosyal-reklam` yetenekleriyle, onay sonrası yapılır. Her canlı yayın panelde (Analitik Merkezi) anlık izlenecek.
