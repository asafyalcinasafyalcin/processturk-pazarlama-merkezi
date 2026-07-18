# Meta + TikTok Reklam Sistemi — Master Plan

> ProcessTürk için Click-to-WhatsApp reklamlarıyla lead üretmek → mevcut WhatsApp chatbot karşılar → teklif → satış.
> Durum: planlama tamam, üretim aşamasına geçiliyor.

---

## Bağlam (neden bu sistem)

ProcessTürk, gıda/sıvı üretim sistemleri ve hazır dolum/kapatma/etiketleme makineleri satıyor.
Mevcut altyapı **outbound** (WhatsApp/e-posta/teklif PDF) ve **landing-v2** hazır; ama Meta/TikTok için
**reklam içeriği üreten bir sistem yok**. icerik-ajani yalnızca LinkedIn/X üretiyor.

Kullanıcı kararları (2026-06-18):
- **Chatbot zaten WhatsApp'ta çalışıyor** → reklam → WhatsApp → chatbot karşılar. *Chatbot inşa edilmeyecek.*
- Kampanya hedefi: **Click-to-WhatsApp** (reklam direkt WhatsApp sohbeti açar).
- 4 tema birden: **Hazır makineler · Üretim hatları · ProcessTürk tanıtımı · TikTok kısa video**.
- Meta tarafı **tamamen hazır** (Business Manager, Sayfa, IG, Reklam Hesabı, WhatsApp Business API).

**Tek eksik halka = reklam içeriği üretim sistemi.** Bu plan onu kuruyor ve dolduruyor.

İstenen sonuç: müşteri **5 saniyede** ne sattığımızı anlasın, WhatsApp'a düşsün, chatbot teklifle karşılasın.

---

## Mimari

> ℹ️ **2026-07-18 notu:** Bu plan yazıldığında kod ayrı bir `Meta_Reklam_Sistemi/`
> klasöründe kurgulanmıştı. Gerçekte buraya, `Processturk_Pazarlama_Merkezi/reklam/`
> altına inşa edildi. Eski klasör boş bir iskelet olarak kalmıştı ve arşivlendi
> (`_ARSIV_2026/Processturk_Meta_Reklam_Sistemi-olu-iskelet-2026-07-18/`).
> Aşağıdaki ağaç **tarihsel plandır**; güncel yapı için bu klasörün kendisine bak.

```
reklam/                    ← (planda: Meta_Reklam_Sistemi/)
  PLAN.md                  ← bu dosya
  AGENT.md                 ← reklam ajanı sözleşmesi (üretilecek)
  skills/
    reklam-uretimi.md      ← creative + copy üretim kuralları (5sn kuralı, marka sesi)
    kampanya-kurulum.md     ← Meta Ads kampanya yapısı, hedefleme, bütçe, A/B
    tiktok-video.md         ← dikey kısa video senaryo/çekim kuralları
  campaigns/
    C1-hazir-makineler/     ← granül/sıvı dolum vb. — hızlı lead
    C2-processturk-tanitim/ ← '5 saniyede ne yapıyoruz' marka reklamı
    C3-uretim-hatlari/      ← sos/salça/süt tam hat (danışmanlık satışı)
    C4-tiktok/              ← dikey video adaptasyonları
  whatsapp-handoff/
    prefill-mesajlari.md    ← her temaya özel WhatsApp açılış mesajı + chatbot etiketi
```

Her `campaigns/Cx-*/` klasörü = bir **kampanya paketi**:
- `brief.md` — hedef, kitle, ülke/dil, bütçe önerisi, başarı metriği
- `ad-copy.md` — 3–5 reklam varyantı: primary text + headline + description (TR + hedef dil)
- `creative-brief.md` — görsel/video konsepti (ne görünecek, metin overlay, renk, logo)
- `whatsapp-prefill.md` — bu kampanyadan gelen lead'in WhatsApp açılış mesajı + chatbot etiketi

---

## Kaynaklar (tek kaynaktan beslenecek — kopya tutma)

| İhtiyaç | Kaynak |
|---|---|
| Makine/fiyat/kapasite | `Processturk_Satis_Dolum_Makinaları/landing-v2/data/siteContent.ts` (13 makine, EXW aralık) |
| ProcessTürk ne yapıyor / değer önermesi | `_core/knowledge-base/PROCESSTURK_MASTER_KNOWLEDGE_BASE.md` |
| Marka sesi | `_core/brand-voice/PROCESSTURK_KURUMSAL_ILETISIM_DILI.md` |
| Asaf kişisel ses (founder yüzü gerekirse) | `_core/brand-voice/ASAF_YALCIN_*.md` |
| Renk/font/logo | Navy `#071739`, Red `#FF3255`, Montserrat/Inter/JetBrains Mono; logo: `Processturk_Satin_Alma_Sistemi/templates/assets/processturk-logo.png` |
| Hedef pazar | Afrika (Cezayir, Mısır, Nijerya, Togo), Körfez, Orta Asya (Azerbaycan, Türkmenistan), TR |
| WhatsApp (chatbot) numarası | `905527062723` — **onaylanacak: chatbot bu numarada mı?** |

---

## 5 Saniye Kuralı (her creative için zorunlu)

İlk 3 saniyede/ilk bakışta üç şey net olmalı: **NE** (ürün/sonuç) · **KİME** · **TEK fayda**.
- Görselde: ürün fotoğrafı + tek rakam (fiyat aralığı / kapasite / teslim süresi) + tek cümle başlık (≤7 kelime).
- "En iyi kalite / lider firma" gibi boş slogan YOK. Somut sayı + somut sonuç.
- Renk disiplini: Navy zemin, Red sadece CTA/rakam (%≤5).

---

## Click-to-WhatsApp + chatbot devri

Reklam CTA → WhatsApp sohbeti açılır → **ön-dolu mesaj** chatbot'a bağlamı taşır:
```
Merhaba, [Granül Dolum Makinesi] hakkında bilgi almak istiyorum. [REKLAM: C1-granul]
```
`[REKLAM: ...]` etiketi chatbot'un doğru ürün/akışı başlatmasını ve kaynağı ölçmemizi sağlar.
> **Onaylanacak:** chatbot bu etiketi okuyup ürün bağlamı alabiliyor mu, yoksa serbest mi başlıyor?

---

## Fazlar (adım adım)

- **Faz 0 — Sistem iskeleti & doğrulama:** AGENT.md + 3 skill + klasör yapısı. WhatsApp numarası ve chatbot etiket davranışı onayı.
- **Faz 1 — C1 Hazır Makineler (öncelik):** En hızlı lead. Granül Dolum + Sıvı Dolum Kafası ($900–1.200) ile başla. 5 reklam varyantı + görsel brief + WhatsApp prefill. *Önce bu yayınlanır.*
- **Faz 2 — C2 ProcessTürk Tanıtım:** '5 saniyede ne yapıyoruz' marka reklamı, retargeting + soğuk kitle.
- **Faz 3 — C3 Üretim Hatları:** Sos/salça/süt tam hat. Lead → mühendis görüşmesi (danışmanlık satışı, direkt kapanış değil).
- **Faz 4 — C4 TikTok kısa video:** C1–C3 mesajlarının dikey video senaryolarına adaptasyonu (5sn kanca formatı).
- **Faz 5 — Ölçüm & optimizasyon:** CPL, WhatsApp sohbet başlama oranı, teklif, satış. Kazanan varyantı ölçekle.

---

## Onay kapısı (KRİTİK)

Reklam **yayını** = dış mesaj + harcama → toplu gönderim kuralına tabi.
Her kampanya paketi yayından önce: içerik gösterilir → platform + bütçe + kitle belirtilir → **Asaf'ın açık onayı beklenir.**
İçerik/creative **üretimi** iç iştir (onaysız yapılır); **launch** yapılmaz.

---

## Ölçüm

Her kampanya `[REKLAM: Cx-...]` etiketiyle izlenir. Takip: CPL (lead başı maliyet), WhatsApp sohbet başlama,
teklif sayısı, satış. Hedef: en düşük CPL'li tema + varyantı ölçekle, kötüleri durdur.

---

## Açık sorular (üretimden önce netleşecek)

1. Chatbot WhatsApp numarası `905527062723` mi? Reklamlar buna mı yönlensin?
2. Chatbot `[REKLAM: ...]` etiketini okuyabiliyor mu, yoksa serbest mi karşılıyor?
3. İlk kampanya bütçesi ve test ülkesi (öneri: düşük bütçe, Cezayir+Mısır, TR+AR+EN)?
4. Görseller: gerçek makine fotoğrafları var mı, yoksa AI/Canva ile mi üretelim?
5. TikTok için video çekim kapasitesi var mı, yoksa AI/stok + metin overlay formatı mı?
