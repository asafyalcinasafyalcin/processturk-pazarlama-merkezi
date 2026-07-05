# İlk Kampanya — PT-Search-EN-Turnkey (Anahtar-Teslim Üretim Hattı · Afrika-EN)

> **Durum: PAUSED kurulacak.** Yayına alma + bütçe artırımı YALNIZ Asaf onayıyla.
> Bu dosya kurulumun **tek doğru kaynağıdır**. İki yolla kurulabilir: (A) Google Ads UI'da
> aşağıdaki adımlarla, (B) Google Ads Editor'da kampanya kabuğu + `PT-Search-EN-Turnkey-keywords.csv`.
> Anahtar kelime / negatif / RSA blokları hem UI hem Editor "yapıştır" kutularına doğrudan yapışır.

## 1) Kampanya ayarları (kabuk — 4 dakika)

| Ayar | Değer |
|------|-------|
| Ad | `PT-Search-EN-Turnkey` |
| Tür | **Arama (Search)** · hedef: Potansiyel müşteriler (Leads) |
| Ağlar | **Yalnız Google Arama** — Arama Ortakları KAPALI, Görüntülü Reklam Ağı KAPALI (temiz veri) |
| Konumlar | **Nijerya, Gana, Kenya, Uganda** |
| Konum seçeneği | **"Hedeflenen konumlardaki kişiler"** (varlık) — "ilgi duyanlar" DEĞİL (boşa harcamayı keser) |
| Dil | **İngilizce** |
| Günlük bütçe | **₺100** |
| Teklif stratejisi | **Tıklamaları En Üst Düzeye Çıkar**, maks. TBM sınırı **₺8** *(dönüşüm ~15–30'a ulaşınca → "Dönüşümleri En Üst Düzeye Çıkar"a geçeriz)* |
| Reklam rotasyonu | Optimize et |
| Dönüşüm hedefi (kampanya) | **Form (SUBMIT_LEAD_FORM) + Bize Ulaşın + Çağrılar** birincil. YouTube abone/görüntüleme, Android installs, purchase → hariç/gözlem |

## 2) Reklam grupları + anahtar kelimeler

> Yapıştırma formatı: `"tırnak"` = sıf-öbek (phrase), `[köşeli]` = tam (exact). UI/Editor bunu otomatik anlar.

### AG1 — Turnkey Production Line
```
"turnkey production line"
"turnkey manufacturing plant"
"complete production line"
"turnkey factory setup"
"turnkey plant supplier"
"production line manufacturer turkey"
[turnkey production line]
[turnkey plant]
```

### AG2 — Sauce & Paste Line
```
"sauce production line"
"tomato paste production line"
"tomato paste plant"
"ketchup production line"
"jam production line"
"food processing line turnkey"
[sauce production line]
[tomato paste production line]
```

### AG3 — Dairy / Milk Plant
```
"milk processing plant"
"yoghurt production line"
"dairy processing plant"
"milk pasteurization line"
"milk plant turnkey"
[milk processing plant]
[dairy plant]
```

## 3) Negatif anahtar kelimeler (KAMPANYA düzeyi — hepsine uygula)

> B2B israfını keser (öğrenci/iş arayan/yedek parça/ikinci el/DIY vb.). UI: Kampanya → Anahtar kelimeler → Negatif → Yapıştır.

```
free
pdf
ppt
download
drawing
cad
layout
diagram
template
"project report"
thesis
wikipedia
"what is"
meaning
definition
job
jobs
career
salary
vacancy
hiring
internship
course
training
tutorial
used
"second hand"
refurbished
rental
rent
lease
"spare parts"
repair
diy
homemade
toy
game
software
simulation
"price list"
```

## 4) Landing (Final URL)

**Hepsi (v1):** `https://www.processturk.com/en/hatlar`  ← İngilizce üretim hatları sayfası; Hızlı Teklif "Üretim Hattı" sekmesi buradan erişilir (Form dönüşümü).
Görünen yol (Path): `production-lines` / `turnkey` → *processturk.com/production-lines/turnkey*

> **Yayından ÖNCE:** canlı slug'lar teyit edilip her reklam grubu kendi ürün sayfasına derin-bağlanacak
> (AG2 → salça/sos hattı, AG3 → süt-yoğurt tesisi) — mesaj eşleşmesi + Kalite Puanı için. v1'de liste sayfası güvenli.

## 5) Responsive Search Ad (her grup için)

**Ortak açıklamalar (Description, ≤90 karakter):**
```
Turnkey production lines from Türkiye — engineered, built, installed and commissioned.
Food-grade AISI 304, European components, PLC control. Scaled to your target capacity.
Installation and operator training included. Trusted Turkish engineering for Africa.
Get your tailored turnkey proposal today. Request a free project quote.
```

**AG1 başlıkları (Headline, ≤30 karakter):**
```
Turnkey Production Lines
Complete Line, One Partner
Design to Commissioning
Made in Türkiye
Install & Training Included
European-Grade Components
AISI 304 Food-Grade Steel
Get Your Project Quote
Built to Your Capacity
Turnkey Industrial Plants
Delivered & Installed
Sauce, Paste & Dairy Lines
Your Factory, Turnkey
Free Tailored Proposal
ProcessTürk Engineering
```

**AG2 başlıkları:**
```
Sauce Production Line
Tomato Paste Plant Turnkey
Ketchup & Sauce Lines
Made in Türkiye
AISI 304 Food-Grade Steel
Install & Training Included
European-Grade Components
Get Your Project Quote
Built to Your Capacity
Design to Commissioning
Delivered & Installed
PLC & Automation Control
Turnkey Food Plants
Free Tailored Proposal
ProcessTürk Engineering
```

**AG3 başlıkları:**
```
Milk Processing Plant
Yoghurt Production Line
Dairy Plant Turnkey
Made in Türkiye
20 Ton/Day & Scalable
Pasteurization & Filling
AISI 304 Food-Grade Steel
Get Your Project Quote
Install & Training Included
European-Grade Components
Delivered in 65-75 Days
Complete Dairy Line
Your Factory, Turnkey
Free Tailored Proposal
ProcessTürk Engineering
```

> İpucu: RSA'da "Made in Türkiye" ve "ProcessTürk Engineering" başlıklarını **konum 1/2'ye sabitlemek**
> (pin) marka+menşei her zaman gösterir. Zorunlu değil.

## 6) Reklam uzantıları (varsa ekle — CTR artırır)

- **Sitelink:** Production Lines · Sauce Line · Dairy Plant · Get a Quote
- **Callout:** Turnkey · Installation Included · Operator Training · AISI 304 · European Components
- **Yapılandırılmış snippet:** Types: Sauce, Tomato Paste, Dairy, Bottling
- **Çağrı uzantısı:** ProcessTürk telefonu (mevcut çağrı dönüşümleri zaten tanımlı)

## 7) Kurulum sonrası kontrol

- [ ] Kampanya **PAUSED** mı? (evet olmalı)
- [ ] Ağ = yalnız Arama, konum = "hedeflenen konumdaki kişiler"
- [ ] 3 grup + anahtar kelimeler + negatifler yüklü
- [ ] Her grupta 1 RSA (Final URL = /en/hatlar)
- [ ] Birincil dönüşüm = Form + Bize Ulaşın + Çağrılar
- [ ] Asaf'a önizleme → **yayın onayı** → o zaman ENABLED
