# Ürün-Bazlı Hedefleme & Konumlandırma Matrisi

> Her ürünün **ayrı coğrafyası, kitlesi, dili ve üslubu** vardır. Reklam kurulumu bu matristen beslenir
> (her ürün `config.json` → `campaign.adsets`). Kaynak: KB hedef pazarlar + `agents copy/french-content/
> skills/francophone-africa-guide` + `arabic-content/skills/gulf-cultural-guide`. Bütçe: **₺50/ad set**.

## Coğrafya setleri
| Set | Ülkeler | Dil |
|-----|---------|-----|
| Afrika-EN | NG, GH, KE | İngilizce |
| Afrika-FR | DZ, MA, TN, SN, CI | Fransızca |
| Körfez | SA, AE, QA, KW, EG | Arapça (EN destekli) |
| Orta Asya | AZ, KZ, UZ | Rusça (ops., premium) |

## Matris (6 HD ürün — HAZIR)
| Ürün | Fiyat | Konsept | Lider açı / üslup | Diller → coğrafya | Kitle |
|------|-------|---------|-------------------|-------------------|-------|
| **granul-dolum** | 1.150 | **A/B** (a+b) | fiyat vs kalite (canlı deney) | EN→Afrika-EN | baharat/kuruyemiş/bakliyat paketleyen küçük üretici, yeni yatırımcı |
| **etiketleme-oto** | 7.475 | a (fiyat/otomasyon) | "elle etiketten otomatiğe" hız + uygun fiyat | EN→Afrika-EN · FR→Afrika-FR | şişeleyen gıda/içecek/kozmetik KOBİ |
| **etiketleme-304-kabinsiz** | 10.350 | b (kalite) | gıda sınıfı 304, kompakt, uygun bütçe | EN→Afrika-EN · FR→Afrika-FR · AR→Körfez | gıda markası, hijyen duyarlı, dar alan |
| **etiketleme-oto-304** | 12.075 | b (kalite) | gıda sınıfı 304 + kapalı kabin, hijyen/üst segment | AR→Körfez · EN→Afrika-EN · FR→Afrika-FR | gıda/içecek markası, kalite öncelikli |
| **sivi-dolum-hat** | 28.750 | b (kalite/mühendislik) | hat/kapasite + Türk müh. + Avrupa bileşen; danışmanlık tonu | AR→Körfez · EN→Afrika-EN · FR→Afrika-FR | bal/tahin/sos üreticisi, hatta geçen |
| **sivi-dolum-4nozul** | 33.350 | b (kalite/kapasite) | yüksek kapasite + Avrupa bileşen; mühendislik | AR→Körfez · EN→Afrika-EN · FR→Afrika-FR | yüksek hacim sıvı üretici |

**Üslup notları:**
- **Afrika (EN/FR):** pratik, net, fiyat+güven; "Türkiye'den, kurulum+destek". francophone-africa-guide: doğrudan, ilişki odaklı.
- **Körfez (AR):** premium, kalite/hijyen/marka; fiyatı öne çıkarma, "gıda sınıfı 304 + Avrupa bileşen". gulf-cultural-guide: resmî, saygı dili, kalite vurgusu.
- **Giriş ürünleri** fiyat öne çıkabilir; **premium/304** teknik/kalite öne çıkar (fiyat ikincil ama görünür).

## Lo-res ürünler (FOTO BEKLİYOR — Asaf HD görsel verince eklenecek)
| Ürün | Fiyat | Ön-konsept (foto gelince) |
|------|-------|---------------------------|
| sivi-dolum-kafa | 1.150 | giriş, bal/tahin küçük üretici · Afrika+Körfez |
| manuel-etiketleme | 345 | en giriş, fiyat · Afrika geniş |
| etiketleme-yari | 1.035 | giriş, fiyat/otomasyon · Afrika |
| tek-hat-kapatma | 28.175 | premium kapatma hattı · Körfez+Afrika |
| iki-hat-kapatma | 37.375 | premium, yüksek kapasite · Körfez |
| can-kapatma-oto | 48.300 | premium konserve/teneke · Körfez+Afrika |
| can-kapatma-yari | 4.600 | orta, konserve giriş · Afrika |

## Toplam bütçe (hepsi açılırsa)
6 HD ürün ad set sayısı: granül 2 + etiketleme-oto 2 + 304-kabinsiz 3 + oto-304 3 + sıvı-hat 3 + 4nozul 3 = **16 ad set × ₺50 = ₺800/gün**.
Asaf alt küme seçebilir; düşük CPL'li ürün/ad set'lerde bütçe artırılır (kanıta dayalı).

## Bağlantı
Bu matris → her `creatives/<slug>/config.json` `campaign.adsets`. Kurulum: `scripts/create_meta_campaign.py <config>`.
İzleme: `scripts/meta_report.py`. Atıf/satış: `TAKIP-ALTYAPISI.md`.
