#!/usr/bin/env python3
"""
Higgsfield SAHNE + marka katmanı = final reklam creative.

hf_scene.py'nin ürettiği tam-kare lifestyle sahnelerinin (<slug>-hf-scene-<size>.png)
üzerine ProcessTürk marka katmanını (logo, badge, başlık, fiyat, alt metin, CTA, site)
templates/product-hf.html ile basar. Eski cutout creative'lerini EZMEZ; çıktı:
  <slug>-hf-<lang>-<size>.png

make_product.py'nin SIZES + beyaz logo + Chrome render yardımcılarını yeniden kullanır.

Kullanım:
  python3 make_hf_overlay.py <creative_config.json>
  python3 make_hf_overlay.py <config.json> --sizes feed story
"""
import argparse
import html
import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_product as mp  # SIZES, find_browser, ensure_white_logo

ROOT = Path(__file__).resolve().parent.parent          # reklam/
TEMPLATE = ROOT / "templates" / "product-hf.html"


def render(tx: dict, size: str, scene: Path, logo: Path, out: Path,
           lang: str = "tr", rtl: bool = False) -> Path:
    s = mp.SIZES[size]
    tpl = TEMPLATE.read_text(encoding="utf-8")
    badge_line = " · ".join(html.escape(b) for b in tx.get("badges", [])[:3])
    repl = {
        "__W__": s["W"], "__H__": s["H"], "__PAD__": s["pad"], "__BADGE_FS__": s["badge"],
        "__BADGE_MT__": s["badge_mt"], "__LOGO_H__": s["logo_h"], "__GAP__": s["gap"],
        "__NAME_FS__": s["name"], "__PRICE_FS__": s["price"], "__PRICE_PRE_FS__": s["price_pre"],
        "__SUB_FS__": s["sub"], "__TRUST_FS__": s["trust"], "__CTAMT__": s["ctamt"],
        "__CTA_FS__": s["cta"], "__RAD__": s["rad"],
    }
    for k, v in repl.items():
        tpl = tpl.replace(k, str(v))
    tpl = (tpl
           .replace("__LANG__", html.escape(lang))
           .replace("__DIR__", "rtl" if rtl else "ltr")
           .replace("__BADGE_LINE__", badge_line)
           .replace("__SCENE__", scene.resolve().as_uri())
           .replace("__LOGO__", logo.resolve().as_uri())
           .replace("__NAME__", html.escape(tx.get("name", "")))
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
        [mp.find_browser(), "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
         "--force-device-scale-factor=1", "--virtual-time-budget=6000",
         f"--window-size={s['W']},{s['H']}", f"--screenshot={out}", tmp.as_uri()],
        capture_output=True, text=True, timeout=90,
    )
    tmp.unlink(missing_ok=True)
    if res.returncode != 0 or not out.exists():
        sys.exit(f"Render başarısız ({size}):\n{res.stderr.strip()}")
    print(f"  · {out.name}")
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("config", type=Path)
    p.add_argument("--sizes", nargs="+", default=None)
    args = p.parse_args()

    cfg_path = args.config.resolve()
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    out_dir = cfg_path.parent
    slug = cfg.get("slug", out_dir.name)
    vsuf = f"-{cfg['variant']}" if cfg.get("variant") else ""

    print("[1/2] Beyaz logo")
    logo = mp.ensure_white_logo()

    print("[2/2] Sahne + marka katmanı render")
    sizes = args.sizes or cfg.get("sizes", ["feed", "story", "square"])
    languages = cfg.get("languages") or {cfg.get("lang", "tr"): cfg}
    outs = []
    for code, tx in languages.items():
        rtl = bool(tx.get("rtl"))
        for size in sizes:
            scene = out_dir / f"{slug}-hf-scene-{size}.png"
            if not scene.exists():
                print(f"  ! sahne yok, atlandı: {scene.name} (önce hf_scene.py çalıştır)")
                continue
            out = out_dir / f"{slug}{vsuf}-hf-{code}-{size}.png"
            render(tx, size, scene, logo, out, lang=code, rtl=rtl)
            outs.append(out)
    print("\nHazır:")
    for o in outs:
        print(" ", o.name)


if __name__ == "__main__":
    main()
