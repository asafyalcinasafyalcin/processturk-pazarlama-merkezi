# WhatsApp Açılış (Pre-fill) Mesajları — Chatbot Devri

Click-to-WhatsApp reklamında "Send message" sonrası kullanıcının sohbetine **ön-dolu** gelen metin.
`[REKLAM: ...]` etiketi: chatbot'a ürün/kampanya bağlamını taşır + kaynağı ölçmemizi sağlar.

> ⚠️ Onay: chatbot bu etiketi okuyup doğru ürün akışını başlatabiliyor mu?
> Numara: 905527062723 (chatbot hattı — onaylanacak).

---

## C1 — Hazır Makineler
- Granül Dolum: `Merhaba, Granül Dolum Makinesi için teklif almak istiyorum. [REKLAM: C1-granul]`
- Sıvı Dolum Kafası: `Merhaba, Sıvı Dolum Kafası hakkında bilgi ve fiyat istiyorum. [REKLAM: C1-sivi-kafa]`
- Etiketleme: `Merhaba, etiketleme makinesi için teklif istiyorum. [REKLAM: C1-etiket]`

## C2 — ProcessTürk Tanıtım
`Merhaba, üretim sistemi kurmak istiyorum. Fikrimi anlatabilir miyim? [REKLAM: C2-tanitim]`

## C3 — Üretim Hatları
- Sos/Salça: `Merhaba, sos/salça üretim hattı kurmak istiyorum. [REKLAM: C3-sos]`
- Süt/Süt ürünleri: `Merhaba, süt ürünleri üretim tesisi hakkında bilgi istiyorum. [REKLAM: C3-sut]`

## C4 — TikTok
Aynı ürün etiketleri, kaynak ayrımı için sonuna `-tt`: örn. `[REKLAM: C1-granul-tt]`

---

### Dil varyantları (örnek: C1-granul)
- AR: `مرحبًا، أريد عرض سعر لماكينة تعبئة الحبيبات. [REKLAM: C1-granul]`
- EN: `Hello, I'd like a quote for the granule filling machine. [REKLAM: C1-granul]`
