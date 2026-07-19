#!/usr/bin/env python3
"""
GERÇEK ÜRÜN reklam creative orkestratörü.
Akış: beyaz logo hazırla → ürün cutout hazırla (fal upscale+bgremove) → navy stüdyo
overlay'ı (templates/product.html) ile feed + story render et.

Kullanım:
  python3 make_product.py campaigns/C1-hazir-makineler/creatives/granul-dolum/config.json
  python3 make_product.py <config.json> --force-cutout    # cutout'u yeniden üret
  python3 make_product.py <config.json> --sizes feed story

config.json (gerçek ürün modu) alanları:
  slug, source_image (gerçek foto yolu), prep_prompt,
  badges [..3..], name, price, price_suffix, sub, trust, cta, sizes
"""
import argparse
import html
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fal_prep_product  # noqa: E402
# Marka motoru — logo dosya adları marka kaydından (env BRAND_ID). BRAND_ID yoksa
# ProcessTürk varsayılanı → canlı creative birebir korunur.
from brand import BRAND as _BR  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent   # reklam/
WORKSPACE = ROOT.parent.parent                   # PROCESSTURK AI (sibling projeler burada)
TEMPLATE = ROOT / "templates" / "product.html"


def site_line(web):
    """Creative anteti için site satırı — marka web'inden (www. ön eki tutarlı)."""
    w = (web or "").strip()
    return w if w.startswith("www.") or "//" in w else f"www.{w}"


# Şablonlardaki marka token'ları (renk/site/ad) — tüm creative'lerde ortak; brand.py'den.
BRAND_REPL = {
    "__NAVY__": _BR["navy"],
    "__RED__": _BR["red"],
    "__SITE__": site_line(_BR["web"]),
    "__BRAND__": _BR["name"],
    "__BRAND_NAME__": _BR["name"],
}
# Renkli logo kaynağı: marka reklam/assets içindeki logo/wordmark (marka-farkındalıklı;
# dosya adı brand kaydından). Marka assetsi yoksa sibling Satın Alma logosuna düşer (referans).
LOGO_WHITE = ROOT / "assets" / _BR["wordmark_white"]
_SATINALMA_LOGO = WORKSPACE / "Processturk_Satin_Alma_Sistemi" / "templates" / "assets" / _BR["satinalma_logo"]
LOGO_SRC = (ROOT / "assets" / _BR["logo_white"]) if (ROOT / "assets" / _BR["logo_white"]).exists() else _SATINALMA_LOGO

CHROME = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
]

SIZES = {
    "feed":  dict(W=1080, H=1350, pad=58, badge=19, badge_mt=14, logo_h=40, machine_h=650, props_h=140,
                  gap=10, name=54, price=84, price_pre=30, sub=29, trust=25, ctamt=16, cta=31, rad=14),
    "story": dict(W=1080, H=1920, pad=72, badge=21, badge_mt=18, logo_h=48, machine_h=960, props_h=190,
                  gap=12, name=62, price=100, price_pre=36, sub=33, trust=29, ctamt=20, cta=35, rad=16),
    "square": dict(W=1080, H=1080, pad=52, badge=18, badge_mt=11, logo_h=37, machine_h=430, props_h=112,
                   gap=7, name=44, price=70, price_pre=25, sub=25, trust=22, ctamt=12, cta=27, rad=13),
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


def ensure_white_logo() -> Path:
    """Sloganı (mikro yazı) kırp → sadece PROCESSTÜRK kelime-markası; lacivert→beyaz, kırmızı korunur."""
    if LOGO_WHITE.exists():
        return LOGO_WHITE
    from PIL import Image
    LOGO_WHITE.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(LOGO_SRC).convert("RGBA")
    w, h = im.size
    im = im.crop((0, 0, w, int(h * 0.72)))  # alt slogan satırını at
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r > 120 and r > g * 1.25 and r > b * 1.25:  # kırmızı (TÜRK) korunur
                continue
            px[x, y] = (255, 255, 255, a)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)  # şeffaf kenarları kırp (sıkı kelime-marka)
    im.save(LOGO_WHITE)
    print(f"  · beyaz kelime-marka: {LOGO_WHITE}")
    return LOGO_WHITE


def render(tx: dict, size: str, cutout: Path, logo: Path, out: Path, props: Path = None,
           lang: str = "tr", rtl: bool = False, template: Path = TEMPLATE) -> Path:
    s = SIZES[size]
    tpl = template.read_text(encoding="utf-8")
    badge_line = " · ".join(html.escape(b) for b in tx.get("badges", [])[:3])
    props_block = ""
    if props and props.exists():
        props_block = f'<img class="props" src="{props.resolve().as_uri()}" alt="">'

    repl = {
        "__W__": s["W"], "__H__": s["H"], "__PAD__": s["pad"], "__BADGE_FS__": s["badge"],
        "__BADGE_MT__": s["badge_mt"],
        "__LOGO_H__": s["logo_h"], "__MACHINE_H__": s["machine_h"], "__PROPS_H__": s["props_h"],
        "__GAP__": s["gap"], "__NAME_FS__": s["name"], "__PRICE_FS__": s["price"],
        "__PRICE_PRE_FS__": s["price_pre"], "__SUB_FS__": s["sub"], "__TRUST_FS__": s["trust"],
        "__CTAMT__": s["ctamt"], "__CTA_FS__": s["cta"], "__RAD__": s["rad"],
    }
    for k, v in repl.items():
        tpl = tpl.replace(k, str(v))
    # Marka token'ları (renk/site/ad) — white-label: BRAND_ID'ye göre değişir.
    for k, v in BRAND_REPL.items():
        tpl = tpl.replace(k, html.escape(str(v)) if k in ("__SITE__", "__BRAND__", "__BRAND_NAME__") else str(v))
    tpl = (tpl
           .replace("__LANG__", html.escape(lang))
           .replace("__DIR__", "rtl" if rtl else "ltr")
           .replace("__BADGE_LINE__", badge_line)
           .replace("__PROPS_BLOCK__", props_block)
           .replace("__LOGO__", logo.resolve().as_uri())
           .replace("__MACHINE__", cutout.resolve().as_uri())
           .replace("__NAME__", html.escape(tx.get("name", "")))
           .replace("__HERO__", html.escape(tx.get("hero", "")))
           .replace("__ORIGIN__", html.escape(tx.get("origin", "")))
           .replace("__BRANDS__", html.escape(tx.get("brands", "")))
           .replace("__PRICE_PRE__", html.escape(tx.get("price_pre", "")))
           .replace("__PRICE_NUM__", html.escape(tx.get("price_num", "")))
           .replace("__SUB__", html.escape(tx.get("sub", "")))
           .replace("__TRUST__", html.escape(tx.get("trust", "")))
           .replace("__CTA__", html.escape(tx.get("cta", ""))))

    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as tf:
        tf.write(tpl)
        tmp = Path(tf.name)
    res = subprocess.run(
        [find_browser(), "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
         "--force-device-scale-factor=1", "--virtual-time-budget=6000",
         f"--window-size={s['W']},{s['H']}", f"--screenshot={out}", tmp.as_uri()],
        capture_output=True, text=True, timeout=90,
    )
    tmp.unlink(missing_ok=True)
    if res.returncode != 0 or not out.exists():
        sys.exit(f"Render başarısız ({size}):\n{res.stderr.strip()}")
    print(f"  · {out}")
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("config", type=Path)
    p.add_argument("--sizes", nargs="+", default=None)
    p.add_argument("--force-cutout", action="store_true")
    # overlay-only: hiç fal/HF çağırma — hazır cutout.png üzerine sadece marka katmanını render et.
    # (Manuel "hazır creative ekle" yolu için; kredi yakmaz.)
    p.add_argument("--overlay-only", action="store_true")
    args = p.parse_args()

    cfg_path = args.config.resolve()
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    out_dir = cfg_path.parent
    slug = cfg.get("slug", out_dir.name)
    template = TEMPLATE.parent / cfg.get("template", TEMPLATE.name)   # B varyantı: product-b.html
    vsuf = f"-{cfg['variant']}" if cfg.get("variant") else ""          # çıktı son eki (A'yı ezmez)

    print("[1/3] Beyaz logo")
    logo = ensure_white_logo()

    print("[2/3] Ürün cutout + sahne öğesi")
    cutout = out_dir / "cutout.png"
    if args.overlay_only:
        # Manuel hazır görsel yolu — fal/HF çağrılmaz; cutout.png hazır olmalı.
        if not cutout.exists():
            sys.exit("overlay-only: cutout.png bulunamadı. Hazır görseli cutout.png olarak koyun.")
        print(f"  · overlay-only: hazır cutout kullanılıyor {cutout}")
    elif args.force_cutout or not cutout.exists():
        rel_src = cfg["source_image"]
        if Path(rel_src).is_absolute():
            src = Path(rel_src)
        else:
            # source_image tabanı config'e göre değişir: eski WORKSPACE(AI_ROOT)-göreli tam yol
            # ya da site-eşitlemeli ROOT.parent(Processturk_Pazarlama_Merkezi)-göreli "data/uploads/..."
            # — ikisini de dene (WORKSPACE önce, geriye dönük davranış korunur).
            src = None
            for base in (WORKSPACE, ROOT.parent):
                cand = (base / rel_src).resolve()
                if cand.exists():
                    src = cand
                    break
            if src is None:
                sys.exit(f"Kaynak foto yok: {rel_src} (aranan: {WORKSPACE / rel_src} , {ROOT.parent / rel_src})")
        fal_prep_product.prep(src, cutout, cfg.get("prep_prompt",
            "304 stainless steel granule filling machine, industrial equipment, sharp studio product photo"),
            refine_prompt=cfg.get("refine_prompt"))
    else:
        print(f"  · cutout mevcut: {cutout}")

    props = None
    if cfg.get("props_prompt"):
        props = out_dir / "props.png"
        if args.overlay_only:
            # overlay-only: yalnız mevcut props kullanılır; fal çağrılmaz.
            if not props.exists():
                props = None
            else:
                print(f"  · overlay-only: mevcut props {props}")
        elif args.force_cutout or not props.exists():
            fal_prep_product.gen_prop(cfg["props_prompt"], props)
        else:
            print(f"  · props mevcut: {props}")

    print("[3/3] Render")
    sizes = args.sizes or cfg.get("sizes", ["feed", "story"])
    languages = cfg.get("languages")
    outs = []
    if languages:
        for code, tx in languages.items():
            rtl = bool(tx.get("rtl"))
            for s in sizes:
                out = out_dir / f"{slug}{vsuf}-{code}-{s}.png"
                render(tx, s, cutout, logo, out, props, lang=code, rtl=rtl, template=template)
                outs.append(out)
    else:
        # tek dil (geriye dönük): üst seviye alanlar
        for s in sizes:
            out = out_dir / f"{slug}{vsuf}-{s}.png"
            render(cfg, s, cutout, logo, out, props, lang=cfg.get("lang", "tr"), template=template)
            outs.append(out)
    print("\nHazır:")
    for o in outs:
        print(" ", o)


if __name__ == "__main__":
    main()
