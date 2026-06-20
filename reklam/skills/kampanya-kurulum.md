# Skill: Kampanya Kurulum (Meta Ads + Ölçüm)

Click-to-WhatsApp kampanyalarının yapısı, hedefleme, bütçe, A/B ve ölçümü.

## Ne zaman kullan
Bir kampanya paketini yayına hazırlarken (Meta Ads Manager yapısını ve hedeflemeyi planlarken).

## Kampanya hedefi
- Hedef: **Engagement → Messaging → WhatsApp** (Click-to-WhatsApp), numara 905527062723.
- CTA: "Send message". Mesaj uygulaması: WhatsApp.
- Ön-dolu mesaj `whatsapp-handoff/prefill-mesajlari.md`'den (`[REKLAM: Cx-...]` etiketli).

## Yapı (önerilen)
```
Campaign (1 tema = 1 kampanya, ör. C1 Hazır Makineler)
  Ad Set A — ülke/dil kümesi 1 (ör. Cezayir+Mısır, AR)   bütçe X
  Ad Set B — ülke/dil kümesi 2 (ör. Afrika geneli, EN)    bütçe X
    Ad 1..5 — copy varyantları (A/B/C/D/E), aynı görselle başla
```
- Önce 1 ülke kümesi + 3 copy varyantı ile küçük test; kazananı ölçekle.
- Advantage+ / geniş kitle + ürün ilgi alanları (gıda üretimi, paketleme, KOBİ) ile başla; daralt sonra.

## Hedefleme
- Ülkeler: Afrika (Cezayir, Mısır, Nijerya, Togo), Körfez, Orta Asya (Azerbaycan, Türkmenistan), TR.
- Dil: pazara göre AR/EN/TR.
- Yaş 25–55, işletme sahibi/girişimci sinyalleri. Hazır makinelerde geniş; üretim hatlarında daha nitelikli/dar.

## Bütçe & test
- Düşük bütçeyle başla (test): kampanya başına küçük günlük bütçe, 3–4 gün öğrenme.
- Karar metriği: **CPL = harcama / WhatsApp sohbet başlama**. En düşük CPL'li ad set + varyantı ölçekle, kötüleri kapat.

## Ölçüm
- Her lead `[REKLAM: Cx-...]` etiketiyle gelir → kaynak kampanya/ürün izlenir.
- Takip: gösterim → tık → WhatsApp sohbet → teklif → satış. Tema bazında CPL ve satış dönüşümü kıyasla.
- Mümkünse UTM/Meta raporu + chatbot etiket sayımı eşleştir.

## Onay kapısı (KRİTİK)
Yayın öncesi Asaf'a sun: creative + copy + platform + hedef ülke/dil + günlük bütçe.
"Evet yayınla / onayla" açık onayı olmadan **launch edilmez**. Belirsiz "tamam/iyi" onay sayılmaz.

## Meta tarafı
Business Manager + Sayfa + IG + Reklam Hesabı + WhatsApp Business API bağlı (hazır).
Yayın elle Ads Manager'dan veya (ileride) Make otomasyonuyla yapılabilir.
