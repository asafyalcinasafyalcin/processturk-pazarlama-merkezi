#!/usr/bin/env python3
"""
Gerçek ürün fotoğrafını reklamda kullanılabilir hale getirir:
  1) PIL ile ön-büyütme (küçük foto için tuval),
  2) fal.ai clarity-upscaler ile detay/keskinlik (makinenin FORMUNU korur — hayali üretmez),
  3) fal.ai birefnet ile arka plan temizleme → şeffaf cutout PNG.

Sonuç: navy stüdyo zeminine oturtulabilen, gerçek ürüne/makineye sadık, net görsel.

Kullanım:
  python3 fal_prep_product.py --src .../granul-dolum.jpeg --out cutout.png \
    --prompt "304 stainless steel granule filling machine, industrial, sharp studio photo"
"""
import argparse
import base64
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fal_image import load_env  # noqa: E402
import os
from PIL import Image  # noqa: E402
Image.MAX_IMAGE_PIXELS = None  # büyük katalog fotoğrafları için bomb uyarısını kapat


def _key() -> str:
    load_env()
    k = os.environ.get("FAL_KEY") or os.environ.get("FAL_API_KEY")
    if not k:
        sys.exit("FAL_KEY bulunamadı (.env.local).")
    return k


def _data_uri(path: Path) -> str:
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def _call(model: str, payload: dict) -> dict:
    req = urllib.request.Request(
        f"https://fal.run/{model}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Key {_key()}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=240) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.exit(f"fal.ai hata {e.code} ({model}): {e.read().decode('utf-8','ignore')[:500]}")


def _result_url(data: dict) -> str:
    if isinstance(data.get("image"), dict):
        return data["image"]["url"]
    if data.get("images"):
        return data["images"][0]["url"]
    if isinstance(data.get("image"), str):
        return data["image"]
    sys.exit(f"fal.ai beklenmeyen yanıt: {json.dumps(data)[:400]}")


def _download(url: str, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=240) as r:
        out.write_bytes(r.read())


def prep(src: Path, out: Path, prompt: str, refine_prompt: str = None, pre_width: int = 768,
         upscale_factor: int = 2, creativity: float = 0.32, resemblance: float = 0.85,
         refine_strength: float = 0.30) -> Path:
    work = out.parent
    work.mkdir(parents=True, exist_ok=True)

    im = Image.open(src).convert("RGB")
    high_res = im.width >= 1000  # gerçek yüksek çöz. foto → hayali iyileştirmeye gerek yok

    if high_res:
        # Çalışma boyutuna küçült (data-URI payload makul, birefnet kaliteli mat çıkarsın)
        target = 1400
        if im.width > target:
            h = round(im.height * target / im.width)
            im = im.resize((target, h), Image.LANCZOS)
        pre = work / "_pre.jpg"
        im.save(pre, quality=92)
        print("  · yüksek çöz. kaynak → birefnet (arka plan temizleme)...")
        cut = _call("fal-ai/birefnet", {"image_url": _data_uri(pre)})
        _download(_result_url(cut), out)
        unsharp = (1.4, 35, 2)  # zaten net; çok hafif
    else:
        # Düşük çöz. kaynak: ön-büyüt → clarity (yapı) → img2img (rötuş) → birefnet
        if im.width < pre_width:
            h = round(im.height * pre_width / im.width)
            im = im.resize((pre_width, h), Image.LANCZOS)
        pre = work / "_pre.png"
        im.save(pre)
        # adımlar fal URL'leriyle zincirlenir (büyük data-URI payload yok)
        print("  · clarity-upscaler (yapı)...")
        up = _call("fal-ai/clarity-upscaler", {
            "image_url": _data_uri(pre), "prompt": prompt,
            "upscale_factor": upscale_factor, "creativity": creativity,
            "resemblance": resemblance, "num_inference_steps": 28,
            "enable_safety_checker": False,
        })
        stage_url = _result_url(up)
        if refine_prompt:
            print("  · flux img2img (kalite rötuşu)...")
            rf = _call("fal-ai/flux/dev/image-to-image", {
                "image_url": stage_url, "prompt": refine_prompt,
                "strength": refine_strength, "num_inference_steps": 36,
                "guidance_scale": 3.5, "enable_safety_checker": False,
            })
            stage_url = _result_url(rf)
        print("  · birefnet (arka plan temizleme)...")
        cut = _call("fal-ai/birefnet", {"image_url": stage_url})
        _download(_result_url(cut), out)
        unsharp = (2.0, 60, 2)

    # kenar temizleme + netlik (alfa 1px erode + yumuşatma, kontur kiri gitsin)
    from PIL import ImageFilter
    cim = Image.open(out).convert("RGBA")
    r, g, b, a = cim.split()
    a = a.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    rgb = Image.merge("RGB", (r, g, b)).filter(
        ImageFilter.UnsharpMask(radius=unsharp[0], percent=unsharp[1], threshold=unsharp[2]))
    cim = Image.merge("RGBA", (*rgb.split(), a))
    cim.save(out)
    print(f"  · cutout hazır: {out}")
    return out


def gen_prop(prompt: str, out: Path, width: int = 1024, height: int = 768) -> Path:
    """Sahne öğesi (ör. baharat/granül dolu kavanozlar) üret + arka plan temizle → şeffaf PNG."""
    print("  · prop üretimi (flux/dev)...")
    img = _call("fal-ai/flux/dev", {
        "prompt": prompt, "image_size": {"width": width, "height": height},
        "num_images": 1, "num_inference_steps": 28,
    })
    print("  · prop arka plan temizleme (birefnet)...")
    cut = _call("fal-ai/birefnet", {"image_url": _result_url(img)})
    _download(_result_url(cut), out)
    print(f"  · prop hazır: {out}")
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--src", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--prompt", default="industrial stainless steel filling machine, sharp studio product photo, 304 stainless")
    p.add_argument("--pre-width", type=int, default=640)
    args = p.parse_args()
    prep(args.src.resolve(), args.out.resolve(), args.prompt, args.pre_width)


if __name__ == "__main__":
    main()
