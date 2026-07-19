# Google Ads Modülü — ProcessTürk

**TAM API yolu kurulu ve kullanımda.** Developer token + Manager (MCC) hesabı + OAuth + refresh token
`.env.local`'da dolu; Claude kampanyaları doğrudan Google Ads API üzerinden kurar ve yönetir
(Customer **325-625-7946**, 3 kampanya kurulu). Ayrıntı için ↓ "Durum" bölümü.

## Klasör

```
google-ads/
  STRATEJI.md          ← kampanya mimarisi (karma: Search lead + PMax marka + remarketing)
  .env.local           ← API kimlik bilgileri (gitignored, asla koda/çıktıya yazılmaz)
  configs/             ← config-driven kampanya tanımları (create_campaign.py girdisi)
  scripts/             ← Python API script'leri (_client.py) + yönetim araçları
    create_campaign.py     ← JENERİK config-driven kampanya kurucusu (yeni kampanyalar BURADAN)
    01-hesap-denetimi.js   ← salt-okunur denetim (Ads arayüzüne yapıştırılan JS)
  editor-uploads/      ← eski toplu yükleme dosyaları (tarihsel; API yolu bunları geçersiz kıldı)
  outputs/             ← rapor çıktıları
```

## Nasıl çalışır (birincil yol: API)

**1. Python + Google Ads API** — kurulum, yönetim, optimizasyon, rapor. Birincil yol.
Kimlik `.env.local`'dan gelir (`scripts/_client.py`). Yeni kampanya = `configs/` altında bir JSON +
`create_campaign.py` (aşağı bkz.); yönetim = `rapor.py` / `guardrail.py` / `kampanya_durum.py`.

**2. Google Ads Scripts (JS)** — yalnız hesap-içi denetim için (`01-hesap-denetimi.js`).
`Araçlar → Toplu işlemler → Komut dosyaları → (+)` → yapıştır → yetkilendir → Çalıştır → Günlükler.

**3. Ads Editor / Toplu yükleme** — *tarihsel*. API bağlanmadan önceki yoldu (`editor-uploads/`).
Yeni kampanyalar için kullanılmaz; kayıt olarak duruyor.

## Kampanya kurma (config-driven)

Her kampanya için ayrı script yazılmaz — tek jenerik kurucu + bir JSON config:

```bash
python3 scripts/create_campaign.py configs/PT-Search-EN-Turnkey.json --dry   # doğrula, HİÇBİR API çağrısı yok
python3 scripts/create_campaign.py configs/PT-Search-EN-Turnkey.json         # PAUSED kur
```

Kurucu kurmadan önce zorlar: her Final URL AdsBot'a **200** mü · başlık ≤30 · açıklama ≤90 · path ≤15 ·
RSA başlık ≤15 adet / açıklama ≤4 adet. Kampanya **PAUSED** doğar; yayın ayrı adım (`kampanya_durum.py`).
Kaynak (marka-bağımsız) sürüm: `Temel_Sistemler/yetenekler/google-ads/toolkit/create_campaign.py`.

> Eski `scripts/create_PT-*.py` dosyaları **EMEKLİ** — üç kampanyanın da tanımı artık `configs/` altında.
> Dosyalar tarihsel kayıt olarak duruyor, yeni kampanya onlardan kopyalanmaz.

## Onay kapısı

Her kampanya **PAUSED** kurulur; canlıya alma ve bütçe artırımı **yalnız Asaf onayıyla**.
Bu, `../reklam/` (Meta) modülüyle aynı disiplindir.

## Durum

- [x] Modül iskeleti + strateji
- [x] `01-hesap-denetimi.js` (salt-okunur denetim scripti)
- [x] Denetim çıktısı alındı → app kampanyası YOK; 3 eski kampanya (2 VIDEO + 1 PMAX) PAUSED, dokunma
- [x] Dönüşüm temeli teyit: GA4 bağlı, Form (SUBMIT_LEAD_FORM) + Bize Ulaşın + Çağrılar ENABLED
- [x] Tam API bağlantısı (OAuth + refresh token) — `scripts/_client.py`, oku+yaz çalışıyor
- [x] İlk kampanya API ile kuruldu → `scripts/create_PT-Search-EN-Turnkey.py` (id 23998449813)
- [x] Landing doğrulandı + AG2/AG3 derin-bağlandı → `scripts/deeplink_...py`
- [x] **CANLI (ENABLED)** — `scripts/kampanya_durum.py <id> <ENABLED|PAUSED>` ile anında duraklat/yayınla
- [x] Yönetim script'leri: `scripts/rapor.py`, `scripts/arama_terimi_negatif.py`, `scripts/guardrail.py`
- [x] İlk 3 günde gösterim %90 sıralama (rank) kaybı tespit edildi (bütçe değil) → `scripts/teklif_guncelle.py <id> <TL> [--apply]` ile CPC ₺8→₺18 (2026-07-08, Asaf onayı)
- [x] 10 saat sonra rank-lost hâlâ %90, ₺18 yetersiz → CPC ₺18→₺50 (2026-07-08 akşam, Asaf onayı)
- [x] `run-saglik-kontrolu.sh` + launchd job (`com.processturk.google-ads-saglik`, 12 saatte bir SALT-OKUNUR kontrol) denendi ve TERK EDİLDİ (2026-07-09): Tam Disk Erişimi verildikten sonra "Operation not permitted" düzeldi ama `claude -p` arka planda "Not logged in" verdi (Keychain/OAuth erişilemiyor); resmi çözüm (`--bare` + ayrı ANTHROPIC_API_KEY) Asaf'ın kararıyla maliyet/karmaşıklık gerekçesiyle uygulanmadı. Job unload edildi, plist duruyor (ileride API key alınırsa `--bare` ile tekrar kurulabilir). Sağlık kontrolü artık yalnız istek üzerine elle yapılır.
- [x] 2026-07-10: CPC ₺50 rank-lost'u %90→%19'a düşürdü, YENİ darboğaz bütçe oldu (budget-lost %72, guardrail.py uyardı) → `scripts/butce_guncelle.py <id> <TL> [--apply]` ile günlük bütçe ₺100→₺200 (Asaf onayı). İlk gerçek trafik: 68 gösterim/12 tık/₺43 harcama (3 gün), tamamı "Turnkey Production Line" grubundan; diğer 4 grup hâlâ sıfır
- [x] İlk dönüşüm GELDİ (2026-07-14, EN-Turnkey) → ilk CPL ≈ ₺991; sağlıklı CPL için 2-3 dönüşümlük örneklem bekleniyor
- [x] 2026-07-10: Körfez (Asaf isteği) → `scripts/create_PT-Search-AR-Gulf.py` (id 24020316122), **PAUSED**, KW/QA/SA/AE/EG, AR, 3 reklam grubu (Turnkey/Sauce/Dairy) × 19 anahtar kelime, URL `processturk.com/ar/hatlar` AdsBot 200 doğrulandı. Anahtar kelime+ad copy Meta sisteminden miras (`reklam/campaigns/C3-uretim-hatlari/creatives/sos-hatti/` — zaten Asaf onaylı Arapça metin). CPC ₺30/gün başlangıç (EN'in ₺8 dersi: düşük başlamadık), bütçe ₺100/gün. **CANLI (ENABLED, 2026-07-10)** — Asaf "yayına al" dedi, url_kontrol geçti, yayınlandı
- [x] 2026-07-10: Uganda+Fildişi gezi kampanyası (Asaf isteği, 10 gün) → `scripts/create_PT-Trip-UG-CI.py` (id 24020388845), geo Uganda+Côte d'Ivoire, dil EN+FR, 6 reklam grubu (3 EN + 3 FR) × 31 anahtar kelime, tarih 2026-07-10→2026-07-19 (Google native `start_date_time`/`end_date_time`, otomatik durur). EN içerik EN-Turnkey'den, FR içerik Meta ad-copy.md'den miras. URL `processturk.com/en|fr/hatlar` AdsBot 200 doğrulandı. Bütçe ₺150/gün ilk 5 gün (2026-07-14'e kadar) → **gün 5'te elle `butce_guncelle.py 24020388845 60 --apply` ile ₺60/gün'e düşürülecek** (otomasyon yok, hatırlatma gerekiyor). CPC ₺35/gün. **CANLI (ENABLED, 2026-07-10)** — Asaf "canlıya al" dedi, url_kontrol geçti, yayınlandı
- [x] 2026-07-15: PT-Trip-UG-CI **PAUSED** (Asaf "Trip'i kapat" dedi — bütçe indirimi yerine tamamen durduruldu; kampanya 10 Tem'den beri yalnız 4 gösterim almış, harcama ₺0'dı). 14 Tem'deki ₺150→₺60 indirim planı böylece geçersiz.
- [x] 2026-07-14: **İLK GERÇEK DÖNÜŞÜM** — EN-Turnkey 1 dönüşüm (Google Dönüşümler sütunu + Analitik Merkezi paid-search lead, kaynak `hatlar-sticky` = 12 Tem'de eklenen mobil teklif çubuğu). 7 günlük CPL ≈ ₺991 (tek dönüşümle erken okuma)
- [x] 2026-07-15: AR-Gulf günlük bütçe ₺100→₺200 (Asaf onayı; rank-kayıp %0'dı ama bütçe-kayıp %85 — ₺50 CPC'ye ₺100 bütçe dar geliyordu, Google pacing gösterimleri kısıyordu)
- [x] 2026-07-12: AR-Gulf ve Trip-UG-CI 2 gündür SIFIR gösterim (reklamlar onaylı, sorun rank-lost %90 = düşük teklif) → Asaf onayıyla CPC AR-Gulf ₺30→₺50, Trip-UG-CI ₺35→₺60 (`teklif_guncelle.py --apply`)
- [x] 2026-07-12: Dönüşüm-sıfır teşhisi yapıldı → izleme zinciri SAĞLAM (site etiketi AW-11353025326 + doğru label canlıda yüklü, trackLead() Hızlı Teklif/iletişim/chat'e bağlı; Analitik Merkezi 30 günde 67 paid-search ziyareti kaydetmiş = tıklar geliyor). Gerçek sorun: 67 Google ziyaretçisinden 0 lead — ölçüm değil, LANDING dönüşüm oranı sorunu. Ek bulgu: Google'daki "Potansiyel müşteri formu gönderimi" işlemi İKİNCİL işaretli (`include_in_conversions_metric=False`) → lead gelse bile kampanya "Dönüşümler" sütununda görünmez; birincile çevirme Asaf onayı bekliyor (API komutu hazır)
- [x] 2026-07-12: "Potansiyel müşteri formu gönderimi" birincil yapıldı (Asaf onayı). Ders: `conversion_action.include_in_conversions_metric` API'de SALT-OKUNUR; birincillik hesap düzeyi `customer_conversion_goal`'dan yönetilir → `SUBMIT_LEAD_FORM~WEBSITE` hedefi `biddable=True` yapıldı, işlem doğrulandı (dönüşüm-metriğinde=True)
- [x] 2026-07-12: Landing dönüşüm katmanı CANLI — /hatlar hero CTA + güven çipleri + mobil yapışkan teklif çubuğu (ilk dönüşüm bu çubuktan geldi)
- [x] 2026-07-18 (Asaf onayı, 3 aksiyon): ① EN-Turnkey bütçe ₺200→₺100/gün ("gereksiz harcamayalım"; 7g CPL ₺1.298 tek dönüşümle). ② 16 katalog-dışı negatif kelime (snack pellet/chin chin/paint/krones/noodles/detergent/candy/napkin/pallet/plantain/sausage roll/steel pipe/can production line/lean manufacturing/assembly line/mass production, phrase) EN-Turnkey + AR-Gulf'a eklendi (mükerrer kontrolü ile; her ikisinde 40→56). ③ **AR-Gulf'a İNGİLİZCE katman** → `scripts/add_en_groups_gulf.py` (idempotent, --dry destekli): kampanya diline EN (1000) eklendi (AR korundu), EN-Turnkey'in 3 ana grubunun 19 kelime+3 RSA'sı "(EN-Gulf)" grupları olarak kopyalandı (CPC ₺50), URL'ler AdsBot 200 doğrulandı. Gerekçe: AR kelime setinin Körfez'de hacmi yok (8 günde 3 gösterim; teklif+bütçe artışları çözmedi) — Körfez B2B alıcısı EN arar. Reklamlar inceleme kuyruğunda (birkaç saat)
- [ ] 2026-07-19+: EN-Gulf grupları gösterim almaya başladı mı kontrol et; Gulf harcamaya başlarsa ₺200/gün bütçenin gerçekten dolup dolmadığını izle (toplam tavan artık ₺300/gün)
- [ ] Düşük CPL → Afrika-FR dalgası + marka (PMax) katmanı

## Yönetim script'leri (kendi kendine dönen kısım)

| Script | Ne yapar | Güvenli mi |
|--------|----------|------------|
| `rapor.py [gün]` | Kampanya+grup+arama performansı; `outputs/rapor-<tarih>.txt` | Salt-okunur |
| `arama_terimi_negatif.py [--apply]` | Alakasız aramaları negatif olarak önerir/ekler | `--apply` yalnız harcama azaltır |
| `guardrail.py [--apply]` | Bütçe darboğazı + yüksek CPL + israf kelime uyarısı; `--apply` israf kelimeyi duraklatır | Bütçe artırımı ASLA otomatik değil (Asaf onayı) |
| `url_kontrol.py [id]` | Kampanyanın TÜM Final URL'lerini AdsBot+tarayıcı gözünden 200 doğrular | Salt-okunur |
| `kampanya_durum.py <id> <ENABLED\|PAUSED> [--force]` | Anında duraklat/yayınla | ENABLED → önce URL kontrolü, geçmezse yayınlamaz |

Varsayılan hepsi **önce gösterir** (dry); değişiklik için `--apply`. Bütçe artırımı hiçbir zaman otomatik yapılmaz.

## ⛔ ZORUNLU KURAL — URL doğrulaması olmadan yayın YOK

Bir reklamın Final URL'i **AdsBot-Google gözünden 200 dönmeden** yayına alınmaz. Google, hedef
URL AdsBot için 404/403/engel dönerse reklamı reddeder (bir sayfa tarayıcıda açılıp AdsBot'a kapalı
olabilir). Bu yüzden:

1. **Bir Final URL'i asla liste/çıkarımdan güvenerek kullanma** — her URL `url_kontrol.py` ile
   TEK TEK 200 doğrulanır (hem AdsBot hem tarayıcı UA).
2. **`kampanya_durum.py ... ENABLED`** yayına almadan önce bu kontrolü otomatik yapar; geçmezse durur.
3. **Yeni grup/URL ekleyen script'ler** (ör. `add_dedicated_groups.py`) yazmadan önce `url_kontrol.check_urls()` çağırır — canlı kampanyaya bozuk URL girmesini önler.
4. URL değişince (deep-link vb.) hemen `url_kontrol.py` koş.

> Ders (2026-07-05): Bir grup, var sanılan ama 404 olan bir sayfaya bağlandı → Google reddetti.
> Kök neden: URL tek tek doğrulanmadan kullanıldı. Kural artık kodda zorunlu.

## İlişkili

- Hedefleme/ürün matrisi (miras): `../reklam/campaigns/HEDEFLEME-MATRISI.md`
- Meta modülü (kardeş kanal): `../reklam/AGENT.md`
- Landing/lead motoru: Kurumsal site Hızlı Teklif (`Processturk_Web_Sitesi/`) veya dolum landing

## Haftalık otomatik rapor (cron) — KURULMADI, Asaf kendi kurar

Elle koşulan raporlama/guardrail unutuluyordu (14 Tem'deki ₺150→₺60 bütçe indirimi planı
unutuldu, kampanya sonunda tamamen kapatıldı). Çözüm: tek betik, doğrudan cron'dan.

**Betik:** `../reklam/scripts/haftalik_rapor.sh` — `meta_report.py` + `rapor.py` + `guardrail.py`
(hepsi salt-okunur; guardrail **`--apply` OLMADAN**) koşup çıktıyı tek tarihli dosyaya yazar:
`../reklam/outputs/haftalik/rapor-<tarih>.md` (log: aynı klasörde `haftalik_rapor.log`).

⛔ `claude -p` KULLANILMAZ — arka planda "Not logged in" verir (yukarıdaki 2026-07-09 launchd
denemesi). Bu betik python3 script'lerini doğrudan çağırır, LLM'e ihtiyaç duymaz.

**Kurulum (Asaf kendi çalıştırır — `crontab -e` ile şu satırı ekle):**

```cron
# Her Pazartesi 09:00 — haftalık reklam raporu (SALT ÖNERİ, hiçbir şey değiştirmez)
0 9 * * 1 /bin/bash "/Users/asafyalcin/Downloads/PROCESSTÜRK/PROCESSTURK AI/Processturk_Pazarlama_Merkezi/reklam/scripts/haftalik_rapor.sh" 7 >> "/Users/asafyalcin/Downloads/PROCESSTÜRK/PROCESSTURK AI/Processturk_Pazarlama_Merkezi/reklam/outputs/haftalik/cron.log" 2>&1
```

Notlar:
- Önce elle bir kez dene: `./haftalik_rapor.sh 7` (çıkış 0 = hepsi başarılı, 1 = bir adım hata verdi).
- macOS'ta cron'un klasöre erişebilmesi için `/usr/sbin/cron`'a **Tam Disk Erişimi** gerekebilir
  (Sistem Ayarları → Gizlilik ve Güvenlik → Tam Disk Erişimi).
- Betik hiçbir bütçe/teklif/kelime değiştirmez. Bütçe artırımı asla otomatik değildir;
  guardrail yalnız azaltır ve o da elle `--apply` ile, Asaf onayıyla.
