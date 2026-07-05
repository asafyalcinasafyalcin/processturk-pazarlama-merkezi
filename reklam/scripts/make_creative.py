#!/usr/bin/env python3
"""
Reklam creative orkestratörü: bir config JSON'undan
  1) fal.ai ile YAZISIZ base görsel üretir (yoksa),
  2) her boyut için marka overlay'ını basar.

Kullanım:
  python3 make_creative.py creatives/granul-dolum/config.json
  python3 make_creative.py creatives/granul-dolum/config.json --force   # base'i yeniden üret
  python3 make_creative.py creatives/granul-dolum/config.json --sizes feed story

Maliyet: base görsel config'teki 'model' ile üretilir (varsayılan flux/dev = ucuz).
Base bir kez üretilir ve tüm boyutlarda yeniden kullanılır (tekrar harcama yok).
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fal_image
import render_creative


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("config", type=Path, help="Reklam config JSON yolu")
    p.add_argument("--sizes", nargs="+", default=None, help="feed square story (varsayılan config'ten)")
    p.add_argument("--force", action="store_true", help="Base görseli yeniden üret (yeniden harcama)")
    args = p.parse_args()

    cfg_path = args.config.resolve()
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    out_dir = cfg_path.parent
    slug = cfg.get("slug", out_dir.name)

    base = out_dir / "base.png"
    base_w = int(cfg.get("base_width", 1080))
    base_h = int(cfg.get("base_height", 1350))
    model = cfg.get("model", "fal-ai/flux/dev")

    if args.force or not base.exists():
        print(f"[1/2] fal.ai base görsel üretiliyor ({model}, {base_w}x{base_h})...")
        fal_image.generate(cfg["prompt"], base, model, base_w, base_h)
    else:
        print(f"[1/2] Base görsel mevcut, yeniden kullanılıyor: {base}")

    sizes = args.sizes or cfg.get("sizes", ["feed"])
    print(f"[2/2] Overlay render ediliyor: {', '.join(sizes)}")
    outputs = []
    for size in sizes:
        out = out_dir / f"{slug}-{size}.png"
        render_creative.render(base, cfg, size, out)
        outputs.append(out)

    print("\nHazır:")
    for o in outputs:
        print(" ", o)


if __name__ == "__main__":
    main()
