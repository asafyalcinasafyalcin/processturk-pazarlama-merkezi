#!/usr/bin/env python3
"""
Reklam ÖNİZLEMESİ üretir: bir ürünün creative'ini gerçek Facebook/Instagram feed
reklamı gibi (sayfa kimliği + primary text + görsel + WhatsApp "Send Message" butonu)
gösteren mockup PNG. Amaç: yayından önce "reklam nasıl görünecek" sorusunu yanıtlamak.

Kullanım:
  python3 make_ad_preview.py campaigns/.../creatives/granul-dolum/config.json --langs en fr
"""
import argparse
import html
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# Marka motoru — sayfa adı + wordmark marka kaydından (env BRAND_ID). BRAND_ID yoksa
# ProcessTürk varsayılanı → canlı önizleme birebir korunur.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from brand import BRAND as _BR   # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "templates" / "ad-preview.html"
AVATAR = ROOT / "assets" / _BR["wordmark_white"]
PAGE_NAME = _BR["page_name"]
CARDW = 500
IMGH = round(CARDW * 1350 / 1080)   # feed creative oranı 1080x1350

CHROME = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
]

# Dile göre platform etiketleri (marka değil, Facebook arayüz dili)
UI = {
    "en": dict(dir="ltr", sponsored="Sponsored", frm="from", cta="Send Message",
               like="Like", comment="Comment", share="Share", eyebrow="WA.ME"),
    "fr": dict(dir="ltr", sponsored="Sponsorisé", frm="dès", cta="Envoyer un message",
               like="J'aime", comment="Commenter", share="Partager", eyebrow="WA.ME"),
    "ar": dict(dir="rtl", sponsored="إعلان مموّل", frm="من", cta="إرسال رسالة",
               like="إعجاب", comment="تعليق", share="مشاركة", eyebrow="WA.ME"),
    "ru": dict(dir="ltr", sponsored="Реклама", frm="от", cta="Написать",
               like="Нравится", comment="Комментарий", share="Поделиться", eyebrow="WA.ME"),
}

# Primary text (görselin üstündeki gövde) + link-kartı headline'ı, varyant+dile göre.
# Anahtar: f"{slug}{-variant}" + lang. A = fiyat-odaklı, B = kalite/menşei-odaklı.
PRIMARY = {
    ("granul-dolum", "en"): dict(
        primary="Packing spices, nuts or pulses by hand? A granular filling machine starts at 1,150 USD "
                "— 304 stainless steel, delivered from Türkiye with installation and support.",
        headline="Granular Filling Machine — from 1,150 USD"),
    ("granul-dolum", "fr"): dict(
        primary="Vous emballez épices, fruits secs ou légumineuses à la main ? Une machine de remplissage "
                "granulaire à partir de 1 150 USD — acier inox 304, livrée de Türkiye.",
        headline="Machine de remplissage granulaire — dès 1 150 USD"),
    ("granul-dolum-b", "en"): dict(
        primary="Turkish engineering, European components. Our granular filling machine uses Siemens, "
                "Schneider and Festo parts — 304 stainless, CE certified, with warranty and ready stock. "
                "Quality of Europe at a fair price. From 1,150 USD.",
        headline="Turkish engineering · European components"),
    ("granul-dolum-b", "fr"): dict(
        primary="Ingénierie turque, composants européens. Notre machine de remplissage granulaire utilise "
                "des pièces Siemens, Schneider et Festo — inox 304, certifiée CE, avec garantie et stock prêt. "
                "La qualité européenne à un prix juste. Dès 1 150 USD.",
        headline="Ingénierie turque · composants européens"),
}


def find_browser() -> str:
    for c in CHROME:
        if Path(c).exists():
            return c
    for n in ("google-chrome", "chromium", "chromium-browser"):
        f = shutil.which(n)
        if f:
            return f
    sys.exit("Chrome/Chromium bulunamadı.")


def render(out_dir: Path, slug: str, lang: str, tx: dict, vsuf: str = "") -> Path:
    ui = UI.get(lang, UI["en"])
    key = slug + vsuf
    creative = out_dir / f"{key}-{lang}-feed.png"
    if not creative.exists():
        sys.exit(f"Creative yok: {creative} (önce make_product.py ile üret)")

    copy = PRIMARY.get((key, lang), {})
    primary = copy.get("primary") or f"{tx.get('name','')} — {tx.get('price_pre','')} " \
        f"{tx.get('price_num','')}. {tx.get('sub','')}"
    headline = copy.get("headline") or (f"{tx.get('name','')} — {ui['frm']} {tx.get('price_num','')}"
        if tx.get('name') else tx.get('hero', ''))
    subline = tx.get("sub", "")

    H = 60 + 70 + IMGH + 74 + 42 + 48   # header+primary+img+linkcard+actions + sayfa boşluğu
    repl = {
        "__W__": CARDW + 40, "__H__": H, "__CARDW__": CARDW, "__IMGH__": IMGH,
        "__LANG__": lang, "__DIR__": ui["dir"],
        "__NAVY__": _BR["navy"],   # avatar + creative placeholder zemini (white-label)
        "__AVATAR__": AVATAR.resolve().as_uri(),
        "__PAGE__": html.escape(PAGE_NAME),
        "__SPONSORED__": html.escape(ui["sponsored"]),
        "__PRIMARY__": html.escape(primary),
        "__CREATIVE__": creative.resolve().as_uri(),
        "__EYEBROW__": html.escape(ui["eyebrow"]),
        "__HEADLINE__": html.escape(headline),
        "__SUBLINE__": html.escape(subline),
        "__CTA__": html.escape(ui["cta"]),
        "__A_LIKE__": html.escape(ui["like"]),
        "__A_COMMENT__": html.escape(ui["comment"]),
        "__A_SHARE__": html.escape(ui["share"]),
    }
    tpl = TEMPLATE.read_text(encoding="utf-8")
    for k, v in repl.items():
        tpl = tpl.replace(k, str(v))

    out = out_dir / f"preview{vsuf}-{lang}.png"
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as tf:
        tf.write(tpl)
        tmp = Path(tf.name)
    res = subprocess.run(
        [find_browser(), "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
         "--force-device-scale-factor=2", "--virtual-time-budget=4000",
         f"--window-size={CARDW + 40},{H}", f"--screenshot={out}", tmp.as_uri()],
        capture_output=True, text=True, timeout=90,
    )
    tmp.unlink(missing_ok=True)
    if res.returncode != 0 or not out.exists():
        sys.exit(f"Önizleme render başarısız ({lang}):\n{res.stderr.strip()}")
    print(f"  · {out}")
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("config", type=Path)
    p.add_argument("--langs", nargs="+", default=["en", "fr"])
    p.add_argument("--variant", default=None, help="çıktı/creative son eki (ör. b)")
    args = p.parse_args()

    cfg = json.loads(args.config.resolve().read_text(encoding="utf-8"))
    out_dir = args.config.resolve().parent
    slug = cfg.get("slug", out_dir.name)
    vsuf = f"-{args.variant or cfg.get('variant','')}".rstrip("-") if (args.variant or cfg.get("variant")) else ""
    langs = cfg.get("languages", {})
    print("Reklam önizlemesi:")
    for lang in args.langs:
        render(out_dir, slug, lang, langs.get(lang, {}), vsuf=vsuf)


if __name__ == "__main__":
    main()
