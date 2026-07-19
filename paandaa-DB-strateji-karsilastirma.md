# paandaa DB Stratejisi — 4181 (yerinde Drizzle) vs 4195 (Paandaa Studio, Prisma)

> Karar belgesi. 0B iş emrine başlamadan önce Asaf'ın vereceği stratejik çatalı besler.
> Kanıt: iki kod tabanının doğrudan incelemesi (2026-07-14).
>
> ## ✅ KARAR (2026-07-14): SEÇENEK A
> **4195 (Paandaa Studio) tek gelecek yığın. 0B (`paandaa-faz-0B-is-emri.md`) İPTAL.**
> 4181, yayın son-metresi 4195'e taşınana kadar CANLI kalır; sonra emekliye ayrılır.
> İlk iş emri: **`paandaa-faz-P1-yayin-paritesi-is-emri.md`** (4181 publish + quick-publish
> + 0A guardrail'lerini 4195 TS'ine port).

---

## 1. İki sistem aynı işi yapmıyor — farklı eksende olgun

| Eksen | **4181 — Pazarlama Merkezi** (mevcut) | **4195 — Paandaa Studio** (yeniden yazım) |
|---|---|---|
| Yığın | Next 15 · **JS** · **JSON dosyalar** · ORM/DB yok | Next 16 · **TS** · **Postgres 17 + Prisma 6 + RLS** |
| Çok-kiracılık | Yalnız `dataDir()`/`BRAND_ID` klasör izolasyonu | **Gerçek:** Tenant/User + RLS (ENABLE+FORCE) + auth + `tenantDb()` |
| Kimlik/BYO-key/metering | Yok | **Var** (PBKDF2 auth, AES-şifreli credential, UsageLog + credit-guard 402) |
| Canlı | 🟢 `pazarlama.processturk.com` (aktif geliştiriliyor, 0A commit'leri en üstte) | 🟢 `studio.72.60.134.242.nip.io` (2026-07-07'den beri, 46/46 test) |
| Rota yüzeyi | **34 API + 7 sayfa** | 16 API + panel sayfaları |
| Gerçek üretim verisi | 83 ürün · 135 kütüphane · 30 içerik slug · takvim | 4181'den göç edildi (31 ürün · 135 asset · 302 creative · …) |

**Kritik nokta:** İkisi *aynı eksende yedek değil*. 4181 **özellik-tam** ama tek-kiracılı JSON; 4195 **çok-kiracılı SaaS temeli** ama son-metre eksik.

---

## 2. Özellik paritesi — kim neyi yapabiliyor

| Özellik | 4181 | 4195 | Not |
|---|---|---|---|
| Ürün onboarding | ✅ | ✅ | |
| AI görsel/video (fal/Higgsfield/gpt-image) | ✅ | ✅ | 4195 iki-aşamalı base→videoify |
| İçerik takvimi + onay kapısı | ✅ | ✅ | 4195'te batch onay + ApprovalRule (üstün) |
| **Gerçek sosyal yayın (Meta/LinkedIn/X)** | ✅ **canlı** | ❌ **yok** | 4195'te `api/publish` hiç yok — "P4+ ayrı route" |
| **quick-publish / acil yayın** | ✅ (0A ile güvene alındı) | ❌ yok | |
| **0A düzeltmeleri** (`manual_action_required`, audit, guard) | ✅ | ❌ (hedef pipeline 4195'te yok) | 0A yatırımı yalnız 4181'de yaşıyor |
| Reklam kampanya kurulumu (Meta) | ✅ panelden | 🟡 Python motoru var, **HTTP rotası yok** | |
| website-sync (siteden ürün çek) | ✅ (`hook` dahil) | ❌ rota yok (model hazır) | |
| komut / targeting / report / voice-samples / google-ads | ✅ | ❌ | yardımcı akışlar |
| Landing üretimi · metering · BYO-key · superadmin | ❌ | ✅ | 4195'in yeni yetenekleri |

**Özet:** 4195, çekirdek üretim hattını yeniden kurmuş + SaaS yetenekleri eklemiş; ama **yayın son-metresini ve birkaç yardımcı rotayı** henüz yazmamış. 4181 bu son-metreyi canlı yapıyor (0A tam da bunu sağlamlaştırdı).

---

## 3. Karar için asıl mesele

0B iş emrinin tüm önermesi = "4181'in runtime state'ini Postgres'e koy." **Ama 4195 bunu zaten yaptı** — üstelik 0B'nin Faz 2'ye ertelediği gerçek çok-kiracılık + RLS + auth ile birlikte. Yani:

- **0B'yi uygulamak = ikinci bir Postgres+ORM yığını kurmak.** Sonuç: 4181-Drizzle ↔ 4195-Prisma, ikisi de çok-kiracılı DB, aynı uygulamanın iki paralel yeniden yazımı. **En kötü sonuç bu.**
- 4181, çok-kiracılık/auth ekseninde 4195'in **gerisinde** kalır (0B onları Faz 2'ye erteliyor).
- 4195, yayın/özellik ekseninde 4181'in **gerisinde** (gerçek publish yok).

CLAUDE.md "modüller yerinde rehabilite, tek-platform yeniden-yazım REDDEDİLDİ" diyor — ama o karar *yeni bir yeniden-yazımı* engellemek içindi; **4195 zaten var, canlı ve test edilmiş.** Yani bugünkü gerçek soru "yeniden yazalım mı" değil, "**iki yığını birleştir mi, üçüncü bir çatal mı**".

---

## 4. Seçenekler ve tavsiye

### Seçenek A — 4195'e yakınsa, 0B'yi iptal et *(önerilen)*
4195'i tek gelecek yığın kabul et. Eksik pariteyi kapat: **gerçek yayın pipeline'ını + 0A guardrail'lerini + eksik rotaları (campaign HTTP, website-sync, komut…) 4195 TS'ine taşı**, sonra cutover yapıp 4181'i emekliye ayır.
- **Artı:** Tek gelecek yığın; zaten çok-kiracılı + RLS + auth + canlı; 4181'den idempotent göç scripti **hazır ve koşulmuş** (`migrate-legacy-data.mjs`). paandaa Faz 0C/0D (state machine, scheduler, adapter) doğrudan 4195'te ilerler.
- **Eksi:** Yayın pipeline'ı + 0A düzeltmeleri 4195'te **yeniden yazılmalı** (TS); birkaç rota portu; canlı veri cutover riski.

### Seçenek B — 4181'i yerinde Drizzle'a taşı (0B'yi uygula)
- **Artı:** Özellik-tam canlı sistem korunur; artımlı, düşük regresyon; 0A devam eder.
- **Eksi:** 4195'in DB işini **tekrarlar**; iki Postgres yığını paralel yaşar; çok-kiracılık/auth hâlâ Faz 2'ye ertelenir (4195'te çözülmüş olanı yeniden icat).

### Seçenek C — Şimdilik dondur, yakınsamayı planla
4181'i **JSON olarak olduğu gibi bırak** (0B'yi rafa kaldır), 4195'i gelecek kabul et ama önce parite açığını kapatmayı ayrı iş emirlerine böl. Hız kaybı en az, ama "iki sistem" belirsizliği bir süre sürer.

---

## 5. Tavsiyem

**Seçenek A (4195'e yakınsa, 0B'yi iptal et).** Gerekçe: iki paralel Postgres yeniden yazımı sürdürmenin net bir teknik/iş gerekçesi yok; 4195 daha ileri temele (çok-kiracılık, RLS, auth, metering, landing, canlı, test) sahip ve göç scripti hazır. 0B'yi uygulamak bu ilerlemeyi **çatallar**.

**Tek büyük kayıt:** 4195'in **gerçek yayın pipeline'ı yok** — 0A'nın sağlamlaştırdığı tam da o. Yakınsama kararı verilirse ilk iş emri şu olmalı: *"4181'in publish + quick-publish + 0A guardrail'lerini (manual_action_required, audit, guard) 4195 TS'ine port et."* O taşınana kadar 4181 canlı kalmalı (gerçek yayını o yapıyor).

**Eğer** yakın vadede yayın son-metresi kritik ve cutover iştahı yoksa → Seçenek B/C ile 4181'de devam etmek savunulabilir; ama o zaman 4195'in akıbetine (dondur/emekli) dair net karar gerekir ki iki yığın süresiz paralel yaşamasın.

---

## 6. Kararın 0B iş emrine etkisi

- **A seçilirse:** `paandaa-faz-0B-is-emri.md` **iptal**. Yerine "4195 parite-kapatma + cutover" iş emirleri yazılır. 0A değeri korunur (port edilir).
- **B seçilirse:** 0B iş emri **aynen geçerli**; §0 çatal uyarısı çözülmüş sayılır, İş 1'e başlanır.
- **C seçilirse:** 0B rafa; 4181 JSON'da dondurulur; 4195 parite planı ayrı ele alınır.
