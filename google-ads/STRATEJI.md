# Google Ads — Strateji & Kampanya Mimarisi (Karma: Lead + Marka)

> Bu modül, mevcut Meta reklam sisteminin (`../reklam/`) **ikinci kanalıdır**. Ürün seti,
> coğrafya setleri ve lead mantığı oradan miras alınır; Google'ın **niyet (arama) tabanlı**
> modeline uyarlanır. Kurulum yolu: **hafif** — Google Ads Scripts (`scripts/`) + Editor toplu
> yükleme (`editor-uploads/`). Developer Token / OAuth / MCC GEREKMEZ.

## Meta ↔ Google farkı (mimariyi bu belirler)

| | Meta | Google |
|---|------|--------|
| Mantık | İlgi/kitle (push) | **Niyet — arama** (pull): "granule filling machine price" arayan sıcak lead |
| Lead kapısı | Click-to-WhatsApp (native) | **Landing sayfası + dönüşüm takibi** (Google'da native WhatsApp yok) |
| En güçlü format | Feed/Reels creative | **Search** (alt huni) + PMax/Demand Gen (üst huni) |

**Sonuç:** Google'da lead, WhatsApp'a doğrudan değil, bir **landing sayfasına** iner; oradan
form (Hızlı Teklif) / WhatsApp tıklaması / arama ile dönüşür. Landing + dönüşüm takibi bu yüzden
Meta'dakinden daha kritik.

## Katmanlı yapı (karma = lead + marka)

| Katman | Kampanya türü | İş | Öncelik | Başlangıç bütçe payı |
|--------|---------------|-----|---------|----------------------|
| **1 — Lead (alt huni)** | Search | Makineyi/çözümü **arayan** kişiyi yakala → landing → teklif | İLK açılır | ~%70 |
| **2 — Remarketing** | Display / PMax segmenti | Siteyi gezip dönüşmeyeni geri getir | 1. katmanla birlikte (ucuz) | ~%10 |
| **3 — Marka + keşif (üst huni)** | Performance Max / Demand Gen | Marka bilinirliği + görsel keşif, processturk.com'a nitelikli trafik | Veri gelince | ~%20 |

**Kural:** Hepsini gün 1 açmayız. **Önce Search + küçük remarketing** ile başla, düşük CPL'li
tema/pazar belirsin, sonra bütçeyi oraya kaydır ve marka katmanını büyüt (kanıta dayalı).

## Coğrafya setleri (Meta matrisinden miras)

| Set | Ülkeler | Dil | Google notu |
|-----|---------|-----|-------------|
| Afrika-EN | NG, GH, KE, UG | İngilizce | Geniş arama hacmi, düşük TBM (Uganda resmî dili EN) |
| Afrika-FR | DZ, MA, TN, SN, CI | Fransızca | Fransızca anahtar kelimeler şart |
| Körfez | SA, AE, QA, KW, EG | Arapça (+EN) | Arapça arama + premium üslup; kalite öne |
| Orta Asya | AZ, KZ, UZ | Rusça (ops.) | Rusça anahtar kelimeler; premium |

## Ürün seti (Meta matrisiyle aynı — `../reklam/campaigns/HEDEFLEME-MATRISI.md`)

Dolum/etiketleme makineleri + anahtar-teslim üretim hatları. Search için ürün → **arama niyeti**:

| Ürün grubu | Örnek arama niyeti (EN) | Örnek (FR) | Örnek (AR) |
|------------|-------------------------|------------|------------|
| Granül dolum | granule filling machine, powder filling machine price | machine de remplissage granulés | آلة تعبئة الحبيبات |
| Etiketleme | automatic labeling machine, bottle labeler | machine d'étiquetage automatique | آلة وضع الملصقات |
| Sıvı dolum hattı | liquid filling line, honey/sauce filling machine | ligne de remplissage liquide | خط تعبئة السوائل |
| Anahtar-teslim hat | turnkey sauce production line, ketchup factory setup | ligne de production clé en main | خط إنتاج جاهز |

> Kesin anahtar kelime listesi + negatif kelimeler kampanya başına `editor-uploads/` içinde
> üretilir (Keyword Planner + arama-niyeti araştırması). Negatif kelime disiplini (ör. "spare
> parts", "repair", "job", "second hand" — hedefe göre) CPL'i doğrudan düşürür.

## Dönüşüm takibi (lead ölçümünün olmazsa olmazı)

Google, "lead geldi mi" bilgisini ancak **dönüşüm aksiyonu** tanımlıysa öğrenir; akıllı teklif
bununla çalışır. Web sitesinde (Faz 13) GA4 + Google Ads ölçümü zaten bağlı → muhtemelen tag
kurulu, sadece **dönüşüm aksiyonlarının doğru tanımlı** olduğunu teyit + eksikse kurarız:
- Teklif formu gönderimi (Hızlı Teklif) → **birincil** dönüşüm
- WhatsApp tıklaması / "beni arayın" → birincil/ikincil
- Telefon araması (call) → ikincil

`scripts/01-hesap-denetimi.js` çıktısı mevcut dönüşüm aksiyonlarını listeler → buradan netleşir.

## Onay kapısı (Meta ile aynı disiplin)

- Tüm kampanyalar **PAUSED (duraklatılmış)** kurulur.
- Canlıya alıp para harcatmak **yalnız Asaf'ın açık onayıyla** ("yayına al / onayla").
- Bütçe artırımı da onaylıdır; öneriler kanıta (CPL) dayanır.

## ⛔ URL doğrulama kapısı (kodda zorunlu)

Her Final URL, yayından önce **AdsBot-Google gözünden 200** doğrulanır (`scripts/url_kontrol.py`).
Liste/çıkarımdan gelen slug'a güvenilmez; her URL tek tek denenir. `kampanya_durum.py ... ENABLED`
ve URL yazan script'ler bu kontrolü otomatik yapar, geçmezse yayın/ekleme durur. (Ders: 404 sayfaya
bağlı reklam Google tarafından reddedildi → kontrol artık zorunlu.)

## İş akışı (hafif yol)

1. **Denetim** — `scripts/01-hesap-denetimi.js` çalıştır → envanter + dönüşüm durumu.
2. **Arşiv** — eski app kampanyaları PAUSED/arşiv (script veya UI).
3. **Kur** — `editor-uploads/<kampanya>.csv` üret → Ads Editor / Toplu yükleme ile içeri aktar (PAUSED).
4. **Ölç & optimize** — `scripts/` içindeki rapor/guardrail script'leri (bütçe, arama terimi, negatif kelime, haftalık CPL raporu).
5. **Ölçekle** — düşük CPL'li pazar/temada bütçe artır (Asaf onayı), marka katmanını büyüt.
