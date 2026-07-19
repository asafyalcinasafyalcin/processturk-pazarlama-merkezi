# paandaa — Faz 0B İş Emri (Claude Code'a verilebilir)

> # ⛔ İPTAL (2026-07-14) — bu iş emri UYGULANMAYACAK
> DB stratejisi kararı **Seçenek A** oldu (bkz. `paandaa-DB-strateji-karsilastirma.md`):
> 4195 Paandaa Studio tek gelecek yığın, 4181'i yerinde Drizzle'a taşımak (0B) İPTAL.
> Bu dosya yalnız kayıt için tutulur. Yerine: `paandaa-faz-P1-yayin-paritesi-is-emri.md`.

> **Bu belge doğrudan Claude Code'a verilmek üzere yazıldı.** Tek fazın (0B) tam,
> cerrahi tarifi. Kapsamı aşma; "dokunma" listesine uy; her iş için kabul kriterini geçir.
> Ön koşul: **0A tamamlandı ve commit'lendi** (assisted→`manual_action_required`, quick-publish
> guard+audit, `lib/audit.js`). Bu iş emri onların üstüne gelir.

---

## 0. Kilitlenen kararlar (bu iş emrinin bağlamı)

| Karar | Seçim | Gerekçe |
|---|---|---|
| **Veritabanı** | **Postgres (Docker) + Drizzle ORM** | 0A tablosunda kilitlendi. Hafif, tipli, migration'lı; vendor kilidi yok. |
| **TypeScript** | **0B'den itibaren yeni modüller TS**; mevcut `.js` DOKUNULMAZ | `tsconfig` bu fazda eklenir; `allowJs:true`, `checkJs:false` → eski JS aynen derlenir. Yeni DB katmanı (`db/*.ts`) TS. |
| **Migration hedefi** | **YALNIZ panelin kendi runtime state'i:** `calendar` · `content` · `library` · `settings` | Bunlar panelin ürettiği/yönettiği veridir. |
| **`products.json` KAPSAM DIŞI** | **Dosya olarak KALIR** (DB'ye taşınmaz) | Python reklam scriptleri (`import_prices.py`, `panel_meta_campaign.py`, `hf_scene.py`) + web-sync onu okur. Diller-arası sözleşme; kırılırsa reklam motoru + site eşitleme bozulur. Ürün tek-kaynağı site feed'i → `products.json` olarak kalır. |
| **`gen-cache.json`, `website-sync.json` KAPSAM DIŞI** | Dosya kalır | Cache + sync-metadata; düşük değer, 0B'yi şişirmez. İleride ayrı iş. |
| **Kesim (cutover) güvenliği** | **`DATA_BACKEND=json\|db` env bayrağı**, varsayılan `json` | Migration doğrulanana kadar davranış birebir aynı; tek env ile anında geri dönüş (rollback). |
| **Çok-kiracı** | Her tabloda `tenant_id` sütunu (varsayılan `processturk`) | Mevcut `dataDir()`/`BRAND_ID` izolasyonunun DB karşılığı. **RLS zorlaması + auth → Faz 2** (0A kararı). 0B'de izolasyon **sorgu katmanında** (her sorgu `tenant_id` filtreler). |

> **⚠️ Başlamadan önce Asaf onayı gereken STRATEJİK ÇATAL:** `Paandaa_Suite` içinde
> **Paandaa Studio (port 4195)** zaten bu pazarlama merkezinin Postgres+**Prisma**+RLS ile
> **yeniden yazılmış** çok-kiracılı sürümüdür ("Eski 4181 canlı, cutover ayrı karar").
> Bu 0B, 4181 kod tabanını **yerinde** Drizzle'a taşır (CLAUDE.md: "modüller YERİNDE
> rehabilite; tek-platform yeniden-yazım REDDEDİLDİ"). İki ayrı çok-kiracılı DB yığını
> (Prisma@4195 + Drizzle@4181) sürdürmek istiyor muyuz, yoksa 4195'e mi kesiyoruz?
> **Bu soru netleşmeden 0B implementasyonuna başlama.**

---

## 1. Faz 0B kapsamı (yalnız bunlar)

1. **İş 1 — Altyapı:** Docker Postgres + Drizzle + `tsconfig` + `drizzle.config.ts` + `DATABASE_URL`. Davranış değişmez.
2. **İş 2 — Şema:** `db/schema.ts` (4 tablo: `content`, `posts`, `assets`, `settings` + `tenant_id`) + ilk migration.
3. **İş 3 — Migration script'i:** idempotent `data/*.json` → DB. Dry-run + sayaç + JSON'ları SİLMEZ (yedek kalır).
4. **İş 4 — Persistence rewire:** `lib/calendar.js` · `lib/content.js` · `lib/library.js` · `lib/settings.js` — **dışa açık fonksiyon imzaları AYNEN**, içleri `DATA_BACKEND` bayrağıyla fs↔Drizzle.
5. **İş 5 — Doğrulama + cutover:** JSON↔DB parite testi → `DATA_BACKEND=db`'ye geç → 18 rotanın regresyon testi.

**Kapsam dışı (0B'de YAPMA):** `products.json`/`gen-cache`/`website-sync` migrasyonu · RLS policy'leri + gerçek auth/RBAC (Faz 2) · UPPERCASE state machine + normalize (0C) · scheduler/kuyruk (0C) · platform adapter refactor (0D) · mevcut `.js` dosyalarını TS'e çevirme.

---

## 2. DOKUNMA (bu dosyaları/davranışları değiştirme)

- **`products.json` ve onu okuyan HER ŞEY:** `lib/products.js`, `lib/paths.js` (`productsJsonPath`), `reklam/scripts/*.py`, `lib/website-sync.js`, `lib/brand.js`, `app/api/campaign`, `app/api/komut`. Ürün verisi dosyada kalır.
- **0A çıktıları:** `manual_action_required` akışı, `lib/audit.js`, `quick-publish` guard/confirm/audit, `/api/calendar` PATCH'teki `manual_action_required → published` istisnası. Aynen korunur.
- **Onay kapısı** (`publish/route.js` `status !== 'approved'` → 409) ve marka fallback (`lib/brand.js`).
- **18 app rotasının çağrı mantığı.** Sadece `lib/*.js`'in İÇİ değişir; rotalar `calendar.js/content.js/library.js/settings.js`'i aynı imzayla çağırmaya devam eder.
- `reklam/` motoru, Python scriptleri, `gen-cache.json`, `website-sync.json`.

---

## 3. İş 1 — Altyapı

**Yapılacak:**
1. **Bağımlılıklar:** `drizzle-orm`, `postgres` (veya `pg`), dev: `drizzle-kit`, `typescript`, `@types/node`. (0A "yeni bağımlılık yok" kuralı 0A'ya özeldi; 0B DB fazıdır.)
2. **`docker-compose.yml`** (kök): tek `postgres:16` servisi. **Host portu 5443** (Merkezi Chat Hub 5442 kullanıyor — çakışma yok). Named volume `pazarlama-pgdata`. DB: `pazarlama`, user/pass env'den.
3. **`.env.example` + `.env.local`:** `DATABASE_URL=postgres://…@127.0.0.1:5443/pazarlama` · `DATA_BACKEND=json` (varsayılan). Değerler `.env.local`'e; sır commit edilmez.
4. **`tsconfig.json`:** `allowJs:true`, `checkJs:false`, `strict:true` (yeni TS için), Next 15 uyumlu (`moduleResolution:"bundler"`, `jsx:"preserve"`). Mevcut JS'i BOZMAZ.
5. **`drizzle.config.ts`** + `db/client.ts` (tek bağlantı havuzu, `DATABASE_URL`'den).
6. **`start-local.sh`:** dev'den önce `docker compose up -d postgres` + `drizzle-kit migrate` çağır (sadece `DATA_BACKEND=db` ise migrate zorunlu; `json` modunda Postgres olmadan da panel çalışmaya devam etmeli — **fail-soft**).

**İş 1 kabul kriteri:** `./start-local.sh` `DATA_BACKEND=json` iken Postgres olmadan da eskisi gibi açılır (regresyon yok); `docker compose up -d postgres` sonrası `db/client.ts` bağlanır; `npx tsc --noEmit` mevcut JS'te hata üretmez.

---

## 4. İş 2 — Şema (`db/schema.ts`, TS)

Doğal anahtarlar korunur (migration idempotency + geri-izlenebilirlik için). Tüm tablolarda `tenant_id text not null default 'processturk'`.

- **`content`** (kaynak `content.json` — ürün başına kanonik üretilmiş içerik = **Content**):
  `(tenant_id, slug)` bileşik PK · `copy jsonb` · `image jsonb` · `video jsonb` · `updated_at timestamptz`.
- **`posts`** (kaynak `calendar.json.items` — platform/dil'e özel yayın örneği = **Variant**):
  `id text PK` (mevcut `post-…` id korunur) · `tenant_id` · `slug` · `platform` · `lang` · `variant_id` · `caption` · `image_url` · `video_url` · `scheduled_at` · `status` · `created_at` · `published_at` · `result jsonb`. `status` şimdilik **serbest string** (UPPERCASE normalize 0C'de).
- **`assets`** (kaynak `library.json` — append-only varlık kütüphanesi):
  `id text PK` (`lib-…` korunur) · `tenant_id` · `slug` · `type` · `url` · `model` · `at timestamptz` · `archived bool default false` · `meta jsonb` (kalan alanlar).
- **`settings`** (kaynak `settings.json` — kiracı başına tek satır):
  `tenant_id text PK` · `data jsonb` (tüm ayar objesi; DEFAULTS `lib/settings.js`'te kalır).

İlk migration `drizzle-kit generate` ile üretilir, `db/migrations/` altına.

**İş 2 kabul kriteri:** `drizzle-kit migrate` boş Postgres'te 4 tabloyu kurar; tekrar çalıştırınca no-op (idempotent).

---

## 5. İş 3 — Migration script'i (`scripts/migrate-json-to-db.mjs`)

- Sırayla `data/settings.json` → `settings`, `data/content.json` → `content`, `data/calendar.json` → `posts`, `data/library.json` → `assets`.
- **Idempotent upsert** doğal anahtar üzerinden (`onConflictDoUpdate`): tekrar çalıştırmak veri çoğaltmaz.
- **`--dry-run`** bayrağı: yazmadan sayıları raporlar. Normal koşuda taşınan satır sayısını yazar.
- **JSON dosyalarını SİLMEZ/DEĞİŞTİRMEZ** — yedek olarak kalır (rollback için).
- `tenant_id` = mevcut klasör (`data/` → `processturk`; `data/<tenant>/` → o tenant). Script tüm mevcut tenant klasörlerini gezer.

**İş 3 kabul kriteri:** `node scripts/migrate-json-to-db.mjs --dry-run` doğru sayıları verir; gerçek koşu sonrası DB satır sayıları JSON içerikleriyle birebir eşleşir; ikinci koşu 0 yeni satır (idempotent).

---

## 6. İş 4 — Persistence rewire (fs ↔ Drizzle, imza değişmez)

`lib/calendar.js`, `lib/content.js`, `lib/library.js`, `lib/settings.js`:
- **Dışa açık fonksiyonlar AYNEN kalır** (`readCalendar`, `addItem`, `updateItem`, `getItem`, `deleteItem`, `readAllContent`, `getContent`, `patchContent`, `addToLibrary`, `listLibrary`, `deleteFromLibrary`, `setArchived`, `readSettings`, `patchSettings` …). İmza + dönüş şekli birebir.
- İçeride `process.env.DATA_BACKEND === 'db'` ise Drizzle sorgusu (tenant_id filtreli), aksi halde mevcut fs yolu. Ortak sabitler (`REAL_PUBLISH`, `META_PUBLISH`, `ICERIK_PUBLISH`, `PLATFORMS`, `DEFAULTS`) yerinde kalır.
- `library.js` **senkron** API'ye sahip (`readFileSync`); DB async. Bu tek uyumsuzluk: DB kolu için ya async'e çevir + çağıranları güncelle **(kapsam artışı — önce çağrı sayısını raporla)**, ya da 0B'de `library`'yi **son sıraya** al / json'da bırakıp ayrı mini-iş yap. **Karar Asaf'a bildirilir, kör async'e çevrilmez.**

**İş 4 kabul kriteri:** `DATA_BACKEND=json` iken davranış birebir eski (regresyon yok). `DATA_BACKEND=db` iken aynı fonksiyonlar DB'den okur/yazar; 18 rota kod değişmeden çalışır.

---

## 7. İş 5 — Doğrulama + cutover

1. **Parite testi:** migration sonrası, aynı çağrılar `json` ve `db` modunda **aynı** sonucu döndürüyor mu (calendar list, content by slug, library list, settings). Betik veya elle curl.
2. **Cutover:** `.env.local` → `DATA_BACKEND=db`. Dev yeniden başlat.
3. **Regresyon (0A senaryoları DAHİL):** takvim listeleme · onayla · assisted publish → `manual_action_required` (publishedAt null) · manual→published işaretle · quick-publish 403/409/assisted + audit satırı · içerik patch · library list/sil · settings patch.
4. **Rollback provası:** `DATA_BACKEND=json`'a dön → panel eski JSON'la sorunsuz (kanıt).

**İş 5 kabul kriteri:** DB modunda tüm akışlar + 0A senaryoları geçer; `json`'a geri dönüş anında ve kayıpsız.

---

## 8. Kapsam dışı — sonraki iş emirleri (harita)

- **0C:** UPPERCASE state machine + `manual_action_required` normalize · scheduler (`node-cron`, ayrı süreç) · PublishJob kuyruğu · retry/backoff · idempotency · receipt-verify.
- **0D:** Platform adapter sözleşmesi · token sağlığı/yenileme · preflight validation.
- **0E:** Operasyon merkezi · bildirim · log görünümü · yedekleme.
- **Faz 2:** RLS policy zorlaması + gerçek RBAC/auth (quick-publish guard bununla değişir).
- **Ayrı mini-işler:** `products.json`→DB (Python sözleşmesi çözülünce) · `gen-cache`/`website-sync` migrasyonu · `library` senkron→async.

---

## 9. Claude Code'a çalışma talimatları

1. **ÖNCE strateji çatalını Asaf'a sor** (§0 uyarısı: Drizzle@4181 yerinde mi, 4195'e cutover mı). Onay gelmeden implementasyona başlama.
2. **Yalnız 0B.** 5 işi sırayla yap; kapsam dışına çıkma.
3. **Küçük, ayrı commit'ler:** (1) altyapı, (2) şema, (3) migration script, (4) persistence rewire, (5) doğrulama/cutover. Her commit'ten sonra ne yaptığını özetle.
4. **Dokunma listesine uy** (§2). `products.json` ve Python sözleşmesine, 0A davranışına, onay kapısına dokunma.
5. **Fail-soft:** `DATA_BACKEND=json` varsayılanı Postgres olmadan çalışmaya devam etmeli — DB'yi zorunlu kılma.
6. **Regresyon:** her işten sonra 0A senaryolarını + temel akışları doğrula.
7. **Secret yok:** `DATABASE_URL` şifresi commit'e girmez; `.env.example`'a yalnız anahtar/şablon.
8. **Kapsam artışı işareti:** `library` senkron→async gibi çağrı sayısını artıran her karar ÖNCE raporlanır, kör uygulanmaz.

### Bittiğinde
0B çıktısı: panel state'i (calendar/content/library/settings) Postgres'te, tipli Drizzle
katmanının arkasında; `products.json` + Python sözleşmesi korunmuş; tek env ile JSON'a
anında dönülebilir; TS altyapısı sonraki fazlar için hazır. Sonra **0C iş emrini**
hazırlarız (state machine + scheduler + kuyruk).
