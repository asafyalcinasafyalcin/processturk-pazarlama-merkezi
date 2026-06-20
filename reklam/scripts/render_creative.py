#!/usr/bin/env python3
"""
Marka overlay'ı render eder: YAZISIZ base görselin üstüne ProcessTürk markası
(rakam + başlık + alt satır + kırmızı WhatsApp CTA) basar, headless Chrome ile PNG alır.

Yazı katmanı burada üretildiği için Türkçe karakter ve font (Montserrat) kusursuz olur.
Tek başına da çalışır; genelde make_creative.py çağırır.
"""
import argparse
import html
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent / "templates" / "overlay.html"

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
]

# Boyut presetleri: (W, H, typografi ölçekleri)
SIZES = {
    # feed 4:5, square 1:1, story/reels/tiktok 9:16
    "feed":   dict(W=1080, H=1350, pad=72, badge=26, brand=40, gap=20, price=150, head=58, sub=32, ctamt=14, cta=34, rad=16),
    "square": dict(W=1080, H=1080, pad=68, badge=25, brand=38, gap=18, price=132, head=52, sub=30, ctamt=12, cta=32, rad=16),
    "story":  dict(W=1080, H=1920, pad=84, badge=28, brand=42, gap=24, price=168, head=64, sub=36, ctamt=18, cta=38, rad=18),
}


def find_browser() -> str:
    for c in CHROME_CANDIDATES:
        if Path(c).exists():
            return c
    for name in ("google-chrome", "chromium", "chromium-browser"):
        f = shutil.which(name)
        if f:
            return f
    sys.exit("Chrome/Chromium bulunamadı. Overlay render için Chrome gerekli.")


def render(base_image: Path, cfg: dict, size: str, out: Path) -> Path:
    s = SIZES[size]
    tpl = TEMPLATE.read_text(encoding="utf-8")

    price = html.escape(cfg.get("price", ""))
    suffix = html.escape(cfg.get("price_suffix", ""))
    price_html = price + (f"<small>{suffix}</small>" if suffix else "")

    repl = {
        "__W__": str(s["W"]), "__H__": str(s["H"]), "__PAD__": str(s["pad"]),
        "__BADGE__": str(s["badge"]), "__BRAND__": str(s["brand"]), "__GAP__": str(s["gap"]),
        "__PRICE__": str(s["price"]), "__HEAD__": str(s["head"]), "__SUB__": str(s["sub"]),
        "__CTAMT__": str(s["ctamt"]), "__CTA__": str(s["cta"]), "__RAD__": str(s["rad"]),
        "__PHOTO__": base_image.resolve().as_uri(),
        "__BADGE_TEXT__": html.escape(cfg.get("badge", "")),
        "__PRICE_TEXT__": price_html,
        "__HEAD_TEXT__": html.escape(cfg.get("headline", "")),
        "__SUB_TEXT__": html.escape(cfg.get("sub", "")),
        "__CTA_TEXT__": html.escape(cfg.get("cta", "WhatsApp'tan teklif al")),
    }
    for k, v in repl.items():
        tpl = tpl.replace(k, v)

    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as tf:
        tf.write(tpl)
        tmp_html = Path(tf.name)

    browser = find_browser()
    result = subprocess.run(
        [
            browser, "--headless", "--disable-gpu", "--no-sandbox",
            "--hide-scrollbars", "--force-device-scale-factor=1",
            "--virtual-time-budget=6000",  # web font (Montserrat) yüklensin
            f"--window-size={s['W']},{s['H']}",
            f"--screenshot={out}",
            tmp_html.as_uri(),
        ],
        capture_output=True, text=True, timeout=90,
    )
    tmp_html.unlink(missing_ok=True)
    if result.returncode != 0 or not out.exists():
        sys.exit(f"Render başarısız ({size}):\n{result.stderr.strip()}")
    print(out)
    return out


def main() -> None:
    import json
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--base", required=True, type=Path, help="Yazısız base görsel (PNG)")
    p.add_argument("--config", required=True, type=Path, help="Reklam config JSON")
    p.add_argument("--size", default="feed", choices=list(SIZES))
    p.add_argument("--out", required=True, type=Path)
    args = p.parse_args()
    cfg = json.loads(args.config.read_text(encoding="utf-8"))
    render(args.base.resolve(), cfg, args.size, args.out.resolve())


if __name__ == "__main__":
    main()
