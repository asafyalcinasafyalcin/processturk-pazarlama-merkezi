#!/usr/bin/env python3
"""
Resmi satış fiyatlarını Excel'den okuyup `data/products.json` (tek kaynak) üretir.
Kaynak: Meta_Reklam_Sistemi/machine_list_chatbot_products_satis_fiyatli.xlsx (Satis_Tablosu sayfası).
Satış Fiyatı = Satınalma × 1.15 (Excel'de hazır). openpyxl gerekmez — stdlib zip+xml ile parse.

Excel güncellenince: python3 scripts/import_prices.py  → products.json yenilenir.
Reklam config'leri price_num/specs'i buradan alır.

BİRLEŞTİRME KURALI (silme yok): products.json artık web sitesi eşitlemesiyle (lib/website-sync.js)
paylaşılıyor. Bu script mevcut dosyayı EZMEZ; kayıt bazında birleştirir:
  · Excel'de olan kayıt → fiyat + spec alanları güncellenir; `marketing`/`website` blokları
    ve site sahipliğindeki alanlar (website'e bağlı kayıtta name_en/category) KORUNUR.
  · Excel'de olmayan kayıt (siteden gelenler dahil) → dokunulmaz.
"""
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent   # reklam/
APP_ROOT = ROOT.parent                           # Processturk_Pazarlama_Merkezi/ (tek data/)
WORKSPACE = ROOT.parent.parent                   # PROCESSTURK AI (sibling projeler burada)
XLSX = ROOT / "machine_list_chatbot_products_satis_fiyatli.xlsx"
OUT = APP_ROOT / "data" / "products.json"
IMG_DIR = WORKSPACE / "Processturk_Satis_Dolum_Makinaları" / "landing-page" / "content" / "images"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# Excel ürün kodu (PRO-FILLING-...) → reklam slug + kaynak görsel adayları (HD önce).
# HD: landing-page/content/images altındaki büyük PNG'ler.
SLUG_MAP = {
    "PRO-FILLING-GFM-001":      ("granul-dolum",          ["granul-dolum.png"]),
    "PRO-FILLING-LFH-001":      ("sivi-dolum-kafa",       ["Liquid Filling Head.png", "sivi-dolum-kafa.png"]),
    "PRO-FILLING-LFL-001":      ("sivi-dolum-hat",        ["Liquid Filling Line (without tanks).png", "sivi-dolum-hat.jpeg"]),
    "PRO-FILLING-MLM-001":      ("manuel-etiketleme",     ["Manual Labelling Machine.jpeg", "manuel-etiketleme.jpeg"]),
    "PRO-FILLING-LFM4-001":     ("sivi-dolum-4nozul",     ["Liquid Filling Machine (4 nozzles).png", "sivi-dolum-4nozul.jpeg"]),
    "PRO-FILLING-SALM-001":     ("etiketleme-yari",       ["Semi Automatic Labelling Machine.jpeg", "etiketleme-yari.jpeg"]),
    "PRO-FILLING-FALC-001":     ("etiketleme-oto",        ["etiketleme-oto.png", "etiketleme-oto.jpeg"]),
    "PRO-FILLING-FALC304-001":  ("etiketleme-oto-304",    ["etiketleme-oto-304.png", "etiketleme-oto-304.jpeg"]),
    "PRO-FILLING-FAL304-NC-001":("etiketleme-304-kabinsiz",["etiketleme-304-kabinsiz.png", "etiketleme-304-kabinsiz.jpeg"]),
    "PRO-FILLING-OLCM-001":     ("tek-hat-kapatma",       ["One Line Capping Machine.jpeg", "tek-hat-kapatma.jpeg"]),
    "PRO-FILLING-TLCM-001":     ("iki-hat-kapatma",       ["Two Line Capping Machine.jpeg", "iki-hat-kapatma.jpeg"]),
    "PRO-FILLING-CCM-001":      ("can-kapatma-oto",       ["Can Capping Machine .png", "Can Capping Machine.png", "can-kapatma-oto.png"]),
    "PRO-FILLING-SACCM-001":    ("can-kapatma-yari",      ["Semi Automatic Can Capping Machine.jpeg", "can-kapatma-yari.jpeg"]),
}


def _read_sheet(z, shared, path):
    t = ET.fromstring(z.read(path))
    rows = {}
    for c in t.iter(NS + "c"):
        m = re.match(r"([A-Z]+)(\d+)", c.get("r"))
        col = 0
        for ch in m.group(1):
            col = col * 26 + (ord(ch) - 64)
        col -= 1
        ri = int(m.group(2))
        v = c.find(NS + "v")
        if v is None:
            continue
        val = v.text
        if c.get("t") == "s":
            val = shared[int(val)]
        rows.setdefault(ri, {})[col] = val
    return rows


def _pick_image(candidates):
    """HD/varlık önceliğine göre ilk var olan görseli ve boyut bilgisini döndür."""
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    for name in candidates:
        p = IMG_DIR / name
        if p.exists():
            try:
                w, _ = Image.open(p).size
            except Exception:
                w = 0
            rel = p.relative_to(WORKSPACE).as_posix()
            return rel, (w >= 1000)
    return None, False


def main():
    z = zipfile.ZipFile(XLSX)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        st = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in st.findall(NS + "si"):
            shared.append("".join(n.text or "" for n in si.iter(NS + "t")))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    names = [s.get("name") for s in wb.iter(NS + "sheet")]
    sheet_idx = names.index("Satis_Tablosu") + 1
    rows = _read_sheet(z, shared, f"xl/worksheets/sheet{sheet_idx}.xml")

    header = rows[1]
    col = {header[i]: i for i in header}
    def g(r, name):
        return rows[r].get(col.get(name, -1), "")

    products = []
    for ri in sorted(rows):
        if ri == 1:
            continue
        code = g(ri, "Ürün Kodu")
        if not code:
            continue
        price = int(float(g(ri, "Satış Fiyatı USD")))
        slug, cands = SLUG_MAP.get(code, (code.lower(), []))
        img, hd = _pick_image(cands)
        products.append({
            "code": code,
            "slug": slug,
            "name_en": g(ri, "Ürün Adı"),
            "category": g(ri, "Kategori"),
            "price_usd": price,
            "price_text": f"{price:,} USD",          # ör. "1,150 USD"
            "specs": {
                "filled_products": g(ri, "Filled Products / Dolum Ürünleri"),
                "filling_range": g(ri, "Filling Range / Dolum Aralığı"),
                "capacity": g(ri, "Capacity / Kapasite"),
                "size": g(ri, "Size / Ölçü"),
                "power": g(ri, "Power"),
                "voltage": g(ri, "Voltage"),
            },
            "video": g(ri, "Video Link"),
            "source_image": img,
            "hd": hd,
        })

    # Mevcut katalogla BİRLEŞTİR — website-sync'in eklediği kayıtlar/bloklar silinmez.
    existing = []
    if OUT.exists():
        try:
            existing = json.loads(OUT.read_text(encoding="utf-8"))
        except Exception:
            existing = []
    by_key = {}
    for rec in existing:
        by_key[rec.get("code") or rec.get("slug")] = rec
        by_key.setdefault(rec.get("slug"), rec)

    merged_count = 0
    for p in products:
        rec = by_key.get(p["code"]) or by_key.get(p["slug"])
        if rec is None:
            existing.append(p)  # Excel'de yeni ürün → aynen ekle
            continue
        merged_count += 1
        site_owned = bool(rec.get("website"))  # site bağlıysa ad/kategori siteden gelir
        rec["price_usd"] = p["price_usd"]      # RESMİ satış fiyatı daima Excel'den
        rec["price_text"] = p["price_text"]
        if not site_owned:
            rec["name_en"] = p["name_en"]
            rec["category"] = p["category"]
        rec.setdefault("specs", {})
        for k, v in p["specs"].items():
            if v:
                rec["specs"][k] = v            # Excel teknik verisi otoritedir
        if p["video"] and not rec.get("video"):
            rec["video"] = p["video"]
        if p["source_image"] and not rec.get("source_image"):
            rec["source_image"] = p["source_image"]
            rec["hd"] = p["hd"]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(products)} Excel ürünü işlendi ({merged_count} birleştirildi) → toplam {len(existing)} kayıt → {OUT}")
    for p in products:
        flag = "HD" if p["hd"] else "lo"
        print(f"  {p['slug']:<22} {p['price_text']:>10}  [{flag}] {p['source_image']}")


if __name__ == "__main__":
    main()
