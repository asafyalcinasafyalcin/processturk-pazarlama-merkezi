#!/usr/bin/env python3
"""
fal.ai görsel üretimi — reklam için YAZISIZ ürün/sahne görseli üretir.
Yazı (rakam, başlık, CTA) sonradan render_creative.py ile marka overlay'ı olarak basılır
(AI Türkçe yazıyı bozar; bu yüzden katmanları ayırıyoruz).

Kullanım:
  python3 fal_image.py --prompt "..." --out base.png [--model fal-ai/flux/dev] [--width 1080 --height 1350]

Anahtar: FAL_KEY ortam değişkeninden veya Meta_Reklam_Sistemi/.env.local dosyasından.
Maliyet notu: varsayılan model flux/dev (ucuz/test). Kaliteyi yükseltmek için
--model fal-ai/flux-pro/v1.1 gibi bir modele geç.
"""
import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # reklam/
APP_ROOT = ROOT.parent                          # Processturk_Pazarlama_Merkezi/ (tek .env.local burada)


def load_env() -> None:
    """FAL_KEY zaten yoksa .env.local'dan yükle (KEY=VALUE satırları)."""
    if os.environ.get("FAL_KEY"):
        return
    env_file = next((p for p in (APP_ROOT / ".env.local", ROOT / ".env.local") if p.exists()), None)
    if env_file is None:
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def generate(prompt: str, out: Path, model: str, width: int, height: int) -> Path:
    load_env()
    key = os.environ.get("FAL_KEY") or os.environ.get("FAL_API_KEY")
    if not key:
        sys.exit(
            "FAL_KEY bulunamadı. Meta_Reklam_Sistemi/.env.local içine 'FAL_KEY=...' ekle "
            "veya ortam değişkeni olarak ver."
        )

    payload = {
        "prompt": prompt,
        "image_size": {"width": width, "height": height},
        "num_images": 1,
        "num_inference_steps": 28,
        "enable_safety_checker": True,
    }
    req = urllib.request.Request(
        f"https://fal.run/{model}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Key {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        sys.exit(f"fal.ai hata {e.code}: {body}")

    images = data.get("images") or []
    if not images:
        sys.exit(f"fal.ai görsel döndürmedi: {json.dumps(data)[:500]}")
    img_url = images[0]["url"]

    out.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(img_url, timeout=180) as r:
        out.write_bytes(r.read())
    print(out)
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--prompt", required=True)
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--model", default="fal-ai/flux/dev")
    p.add_argument("--width", type=int, default=1080)
    p.add_argument("--height", type=int, default=1350)
    args = p.parse_args()
    generate(args.prompt, args.out.resolve(), args.model, args.width, args.height)


if __name__ == "__main__":
    main()
