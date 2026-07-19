#!/usr/bin/env python3
"""
CRM "satıldı/kabul" → Meta Conversions API (Offline/CAPI) geri-beslemesi.

NEDEN VAR: Atıf zincirimiz CPL'de duruyordu. Meta hangi reklamın SOHBET getirdiğini biliyor ama
hangisinin SATIŞ getirdiğini bilmiyor → ne ROAS hesaplanabiliyor ne de algoritma gerçek satışa göre
öğrenebiliyor. Bu script o halkayı kapatır: CRM'de kabul edilmiş sonucu Meta'ya geri gönderir.

TASARIM KURALLARI (bkz `reklam-olcum` yeteneği):
  · DEDUP ANAHTARI = lead ID → `event_id`. Aynı lead iki kez gönderilse Meta tek dönüşüm sayar.
    Ayrıca yerel gönderim defteri (data/capi_gonderim.csv) aynı olayı ikinci kez GÖNDERMEZ.
    "Geç gelen offline güncelleme ikinci satış yaratmamalı" kuralı bu iki katmanla korunur.
  · KİŞİSEL VERİ: telefon/e-posta yalnız normalize + SHA-256 hash olarak gider. Ham kimlik
    bilgisi ne istekte ne de defterde saklanır (deftere yalnız hash'in ilk 12 hanesi yazılır).
    Hash'lemek izin (consent) yerine geçmez — izinsiz kayıt gönderilmez (--izin-alani ile denetlenir).
  · DEĞER TANIMI: `value` = KDV hariç net satış tutarı, iade/iptal düşülmüş. Para birimi zorunlu.
  · VARSAYILAN KURU ÇALIŞMA: gerçekten göndermek için --apply şart (kalan tüm reklam
    script'lerimizle aynı disiplin).
  · TEST: --test-event-code ile Events Manager > Test Events'te veriyi kirletmeden doğrulanır.

KAYNAK GİRDİ (--girdi): CSV veya JSON. Zorunlu alanlar:
    lead_id        → dedup anahtarı (CRM'deki kayıt ID'si; ASLA değişmemeli)
    olay_zamani    → ISO 8601 veya unix saniye (satışın gerçekleştiği an; gönderim anı DEĞİL)
    deger          → net tutar (sayı)
    para_birimi    → TRY/USD/EUR...
  En az biri (eşleştirme için):
    telefon        → E.164'e normalize edilir (+90...)
    eposta
    ctwa_clid      → WhatsApp tık kimliği; VARSA en kesin eşleşme (hash'lenmez, ham gider)
  Opsiyonel:
    izin           → "1"/"true"/"evet" değilse kayıt ATLANIR (--izin-alani ile açılır)
    ref            → [ref: slug-konsept-dil] atıf etiketi (yalnız yerel deftere, Meta'ya gitmez)
    olay_adi       → varsayılan "Purchase"

KULLANIM:
  python3 capi_satis_gonder.py --girdi satislar.csv                        # KURU (hiçbir şey gönderilmez)
  python3 capi_satis_gonder.py --girdi satislar.csv --test-event-code TEST12345 --apply
  python3 capi_satis_gonder.py --girdi satislar.csv --apply                # GERÇEK gönderim

.env.local: META_ACCESS_TOKEN + META_DATASET_ID (yoksa META_OFFLINE_DATASET_ID).
"""
import argparse
import csv
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent     # reklam/
APP_ROOT = ROOT.parent                            # Processturk_Pazarlama_Merkezi/
DEFTER = APP_ROOT / "data" / "capi_gonderim.csv"  # gönderim defteri (idempotency + denetim izi)
DEFTER_COLS = ["gonderim_zamani", "lead_id", "event_id", "olay_adi", "deger", "para_birimi",
               "eslesme", "ref", "sonuc"]

DOGRU = {"1", "true", "evet", "yes", "y", "e", "dogru", "doğru"}


# ---------------------------------------------------------------- env & http
def _env() -> dict:
    f = next((p for p in (APP_ROOT / ".env.local", ROOT / ".env.local") if p.exists()), None)
    if f is not None:
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    tok = os.environ.get("META_ACCESS_TOKEN")
    ds = os.environ.get("META_DATASET_ID") or os.environ.get("META_OFFLINE_DATASET_ID")
    if not tok:
        sys.exit("Eksik .env.local: META_ACCESS_TOKEN gerekli.")
    if not ds:
        sys.exit("Eksik .env.local: META_DATASET_ID (Events Manager > Veri Kaynakları > dataset ID) gerekli.")
    return dict(token=tok, dataset=ds, ver=os.environ.get("META_API_VERSION", "v21.0"))


def _post(env: dict, payload: dict) -> dict:
    """Conversions API'ye POST. Meta hata gövdesini HTTP koduyla birlikte döndürür — yutma."""
    url = f"https://graph.facebook.com/{env['ver']}/{env['dataset']}/events"
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detay = e.read().decode("utf-8", "replace")
        raise SystemExit(f"Meta API hatası (HTTP {e.code}): {detay}")
    except urllib.error.URLError as e:
        raise SystemExit(f"Ağ hatası: {e.reason}")


# ---------------------------------------------------------------- normalize + hash
def _sha(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _norm_tel(t: str) -> str:
    """E.164 rakam dizisi (baştaki + ve ayraçlar atılır). Meta hash öncesi bunu bekler.
    TR yerel format (0532..., 532...) 90'a çevrilir — yanlış ülke koduyla hash'lemek
    eşleşmeyi sessizce sıfırlar, bu yüzden açıkça ele alınır."""
    d = re.sub(r"\D", "", str(t or ""))
    if not d:
        return ""
    if d.startswith("00"):
        d = d[2:]
    elif d.startswith("0") and len(d) == 11:      # 0532xxxxxxx → 90532xxxxxxx
        d = "90" + d[1:]
    elif len(d) == 10 and d[0] == "5":            # 532xxxxxxx → 90532xxxxxxx
        d = "90" + d
    return d


def _norm_eposta(e: str) -> str:
    return str(e or "").strip().lower()


def _olay_zamani(v) -> int:
    """ISO 8601 veya unix saniye → unix saniye. Meta 7 günden eski olayı reddedebilir → uyarılır."""
    s = str(v or "").strip()
    if not s:
        raise ValueError("olay_zamani boş")
    if re.fullmatch(r"\d{9,11}", s):
        return int(s)
    s = s.replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


# ---------------------------------------------------------------- girdi & defter
def _girdi_oku(p: Path) -> list:
    if not p.exists():
        sys.exit(f"Girdi bulunamadı: {p}")
    if p.suffix.lower() == ".json":
        veri = json.loads(p.read_text(encoding="utf-8"))
        return veri if isinstance(veri, list) else veri.get("kayitlar", [])
    with p.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _gonderilmis() -> set:
    """Daha önce başarıyla gönderilmiş event_id'ler — ikinci kez GÖNDERİLMEZ."""
    if not DEFTER.exists():
        return set()
    with DEFTER.open(encoding="utf-8", newline="") as f:
        return {r["event_id"] for r in csv.DictReader(f) if r.get("sonuc") == "ok"}


def _deftere_yaz(satirlar: list) -> None:
    DEFTER.parent.mkdir(parents=True, exist_ok=True)
    yeni = not DEFTER.exists()
    with DEFTER.open("a", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=DEFTER_COLS)
        if yeni:
            w.writeheader()
        w.writerows(satirlar)


# ---------------------------------------------------------------- olay kurma
def _olay_kur(k: dict, izin_alani: str) -> tuple:
    """Tek CRM kaydı → (Meta olayı, defter satırı) veya (None, atlama_sebebi)."""
    lead_id = str(k.get("lead_id") or "").strip()
    if not lead_id:
        return None, "lead_id yok (dedup anahtarı zorunlu)"

    if izin_alani:
        if str(k.get(izin_alani) or "").strip().lower() not in DOGRU:
            return None, "izin yok"

    try:
        ts = _olay_zamani(k.get("olay_zamani"))
    except Exception as e:
        return None, f"olay_zamani geçersiz ({e})"

    try:
        deger = float(str(k.get("deger") or "").replace(",", "."))
    except ValueError:
        return None, "deger sayı değil"
    if deger < 0:
        return None, "deger negatif"

    para = str(k.get("para_birimi") or "").strip().upper()
    if not para:
        return None, "para_birimi yok"

    user_data, eslesme = {}, []
    tel = _norm_tel(k.get("telefon"))
    if tel:
        user_data["ph"] = [_sha(tel)]
        eslesme.append("tel")
    eposta = _norm_eposta(k.get("eposta"))
    if eposta:
        user_data["em"] = [_sha(eposta)]
        eslesme.append("eposta")
    clid = str(k.get("ctwa_clid") or "").strip()
    if clid:
        # ctwa_clid HASH'LENMEZ — Meta ham bekler. En kesin eşleşme budur.
        user_data["ctwa_clid"] = clid
        eslesme.append("ctwa_clid")

    if not user_data:
        return None, "eşleştirme alanı yok (telefon/eposta/ctwa_clid)"

    olay = {
        "event_name": str(k.get("olay_adi") or "Purchase").strip(),
        "event_time": ts,
        "event_id": lead_id,            # ← DEDUP: aynı lead = aynı dönüşüm
        "user_data": user_data,
        "custom_data": {"value": round(deger, 2), "currency": para},
    }
    # CTWA kökenli lead ise Meta'ya mesajlaşma kökenini bildiriyoruz; değilse jenerik offline.
    if clid:
        olay["action_source"] = "business_messaging"
        olay["messaging_channel"] = "whatsapp"   # DOĞRULANMALI: alan adı Events Manager'da teyit edilecek
    else:
        olay["action_source"] = "physical_store"

    defter = {
        "gonderim_zamani": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "lead_id": lead_id,
        "event_id": lead_id,
        "olay_adi": olay["event_name"],
        "deger": olay["custom_data"]["value"],
        "para_birimi": para,
        "eslesme": "+".join(eslesme),
        "ref": str(k.get("ref") or "").strip(),
        "sonuc": "",
    }
    return olay, defter


# ---------------------------------------------------------------- ana
def main() -> None:
    ap = argparse.ArgumentParser(description="CRM satış → Meta CAPI/Offline geri-beslemesi")
    ap.add_argument("--girdi", required=True, help="CSV veya JSON kayıt dosyası")
    ap.add_argument("--apply", action="store_true",
                    help="GERÇEKTEN gönder. Verilmezse hiçbir istek atılmaz (varsayılan kuru çalışma).")
    ap.add_argument("--test-event-code", default="",
                    help="Events Manager > Test Events kodu (veriyi kirletmeden doğrulama)")
    ap.add_argument("--izin-alani", default="",
                    help="Bu sütun doğru değilse kayıt atlanır (ör: --izin-alani izin)")
    ap.add_argument("--yeniden-gonder", action="store_true",
                    help="Defterdeki başarılı gönderimleri YOK SAY (dikkat: mükerrer risk)")
    ap.add_argument("--parti", type=int, default=500, help="İstek başına olay sayısı (varsayılan 500)")
    a = ap.parse_args()

    kayitlar = _girdi_oku(Path(a.girdi))
    if not kayitlar:
        sys.exit("Girdi boş.")

    gonderilmis = set() if a.yeniden_gonder else _gonderilmis()
    olaylar, defterler, atlanan = [], [], []
    gorulen = set()

    for k in kayitlar:
        olay, defter = _olay_kur(k, a.izin_alani)
        if olay is None:
            atlanan.append((str(k.get("lead_id") or "?"), defter))
            continue
        eid = olay["event_id"]
        if eid in gonderilmis:
            atlanan.append((eid, "zaten gönderilmiş (defter)"))
            continue
        if eid in gorulen:
            atlanan.append((eid, "girdide mükerrer lead_id"))
            continue
        gorulen.add(eid)
        olaylar.append(olay)
        defterler.append(defter)

    toplam = sum(o["custom_data"]["value"] for o in olaylar)
    para_birimleri = {o["custom_data"]["currency"] for o in olaylar}
    print(f"Girdi: {len(kayitlar)} kayıt → gönderilecek {len(olaylar)}, atlanan {len(atlanan)}")
    if olaylar:
        print(f"Toplam değer: {toplam:,.2f} " + "/".join(sorted(para_birimleri)))
        if len(para_birimleri) > 1:
            print("  ⚠ Birden fazla para birimi var — Meta bunları TOPLAMAZ, ayrı raporlar. Doğru davranış.")
    for eid, sebep in atlanan[:20]:
        print(f"  - atlandı {eid}: {sebep}")
    if len(atlanan) > 20:
        print(f"  ... ve {len(atlanan) - 20} kayıt daha")

    if not olaylar:
        print("\nGönderilecek olay yok.")
        return

    eski = [o for o in olaylar if time.time() - o["event_time"] > 7 * 86400]
    if eski:
        print(f"  ⚠ {len(eski)} olay 7 günden eski — Meta bunları reddedebilir veya "
              f"optimizasyona katmayabilir (raporlamaya yine de girer).")

    if not a.apply:
        print("\n[KURU ÇALIŞMA] Hiçbir istek atılmadı. Örnek olay (kişisel veri hash'li):")
        ornek = json.loads(json.dumps(olaylar[0]))
        for alan in ("ph", "em"):
            if alan in ornek["user_data"]:
                ornek["user_data"][alan] = [ornek["user_data"][alan][0][:12] + "…(sha256)"]
        print(json.dumps(ornek, indent=2, ensure_ascii=False))
        print("\nGerçekten göndermek için --apply ekle. Önce --test-event-code ile denemen önerilir.")
        return

    env = _env()
    gonderilen = 0
    for i in range(0, len(olaylar), a.parti):
        dilim = olaylar[i:i + a.parti]
        payload = {"data": dilim}
        if a.test_event_code:
            payload["test_event_code"] = a.test_event_code
        sonuc = _post(env, payload)
        kabul = sonuc.get("events_received", len(dilim))
        print(f"  parti {i // a.parti + 1}: {kabul} olay kabul edildi "
              f"(fbtrace_id={sonuc.get('fbtrace_id', '-')})")
        for d in defterler[i:i + a.parti]:
            d["sonuc"] = "ok"
        gonderilen += kabul

    if a.test_event_code:
        print("\n⚠ TEST modu — bu olaylar Events Manager > Test Events'te görünür, "
              "kalıcı veriye ve optimizasyona GİRMEZ. Deftere de yazılmaz.")
    else:
        _deftere_yaz(defterler)
        print(f"\n✓ {gonderilen} olay gönderildi. Defter: {DEFTER}")
        print("Doğrulama: Events Manager > Veri Kaynakları > dataset > 'Etkinlikler' "
              "(görünmesi birkaç dakika sürebilir).")


if __name__ == "__main__":
    main()
