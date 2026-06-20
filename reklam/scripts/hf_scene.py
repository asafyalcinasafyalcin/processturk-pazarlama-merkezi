#!/usr/bin/env python3
"""
Higgsfield lifestyle SAHNE üreteci (reklam görselleri).

Gerçek makine fotoğrafını referans verir (B4: gerçek makineyi koru, hayali üretme),
Higgsfield `product-photoshoot` (lifestyle_scene, gpt_image_2) ile ürünü çalışırken
gösteren premium bir sahne üretir. Makine yüzeyinde YAZI/LOGO/RAKAM yoktur — marka
katmanı (logo, fiyat, CTA) sonradan make_product overlay'i ile basılır.

Çıktılar eski cutout creative'lerini EZMEZ; `<slug>-hf-scene-<ratio>.png` adıyla
creatives/<slug>/ altına iner.

Konum: Processturk_Pazarlama_Merkezi/reklam/scripts/
Gerektirir: higgsfield CLI ($HOME/.local/bin), FAL gerekmez.

Kullanım:
  export PATH="$HOME/.local/bin:$PATH"
  python3 hf_scene.py                       # 6 HD ürün × 3 format
  python3 hf_scene.py granul-dolum          # tek ürün
  python3 hf_scene.py granul-dolum --ratios feed
"""
import argparse
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

from PIL import Image
Image.MAX_IMAGE_PIXELS = None

REKLAM = Path(__file__).resolve().parent.parent           # .../reklam
CENTER = REKLAM.parent                                     # .../Processturk_Pazarlama_Merkezi
AI_ROOT = CENTER.parent                                    # .../PROCESSTURK AI
PRODUCTS = json.loads((CENTER / "data" / "products.json").read_text(encoding="utf-8"))
CREATIVES = REKLAM / "campaigns" / "C1-hazir-makineler" / "creatives"
SRC_DIR = REKLAM / "assets" / "hf-src"

# Meta formatları → Higgsfield product_photoshoot oranı (4:5 desteklenmiyor → 3:4)
RATIOS = {"feed": "3:4", "story": "9:16", "square": "1:1"}

BRAND = ("ProcessTürk — Turkish industrial machinery manufacturer; brand colors deep "
         "navy #1A2B5F and red #D71920; premium, trustworthy, technical B2B")

# Makine yüzeyinde hiçbir yazı/logo/rakam olmasın — marka katmanını biz overlay ederiz.
NOTEXT = ("no text, no brand name, no logo, no readable labels, no digits anywhere on the "
          "machine body or its control panel — all machine surfaces clean and blank; keep "
          "uncluttered negative space at top and bottom for logo and price overlay; "
          "photo-real, premium, food-grade industrial workshop")

# Ürün-bazlı lifestyle senaryosu (slug → (product_context, scene_prompt))
SCENES = {
    "granul-dolum": (
        "ProcessTürk 304 stainless steel semi-automatic granule filling machine actively "
        "filling small jars with colorful spices, nuts and pulses",
        "the real granule filling machine in action, filling clear jars with colorful dried "
        "spices, nuts and pulses pouring as motion, gloved hands placing a jar, warm "
        "professional lighting with subtle deep-navy brand tones",
    ),
    "sivi-dolum-hat": (
        "ProcessTürk stainless steel liquid filling line filling glass jars with golden honey, "
        "tahini and high-viscosity liquids on a production line",
        "the real liquid filling line in action, a clean golden stream of honey filling a row "
        "of glass jars on the line, gloved hands, modern food production hall, warm premium "
        "lighting with subtle deep-navy brand tones",
    ),
    "sivi-dolum-4nozul": (
        "ProcessTürk 4-nozzle stainless steel liquid filling machine filling multiple bottles "
        "simultaneously with liquid product, high capacity",
        "the real 4-nozzle liquid filling machine in action, four parallel streams filling "
        "bottles at once, dynamic high-capacity production line, modern food plant, warm "
        "premium lighting with subtle deep-navy brand tones",
    ),
    "etiketleme-oto": (
        "ProcessTürk full automatic labelling machine with cabin applying labels to bottles "
        "moving on a conveyor",
        "the real automatic labelling machine in action, glossy bottles moving on the conveyor "
        "as clean wrap-around labels are applied, modern bottling line, warm premium lighting "
        "with subtle deep-navy brand tones",
    ),
    "etiketleme-oto-304": (
        "ProcessTürk full automatic 304 stainless steel labelling machine with cabin labelling "
        "bottles on a hygienic food-grade line",
        "the real 304 stainless labelling machine with cabin in action, bottles moving through "
        "the stainless cabin as labels are applied, hygienic food-grade bottling line, warm "
        "premium lighting with subtle deep-navy brand tones",
    ),
    "etiketleme-304-kabinsiz": (
        "ProcessTürk full automatic 304 stainless steel labelling machine without cabin "
        "applying labels to bottles on a stainless platform",
        "the real 304 stainless labelling platform in action, bottles rotating as wrap-around "
        "labels are applied, open stainless line in a modern food workshop, warm premium "
        "lighting with subtle deep-navy brand tones",
    ),
}


def src_for(slug: str) -> Path:
    """products.json'daki source_image'i max 1600px JPG'e küçült (Higgsfield upload limiti)."""
    prod = next((p for p in PRODUCTS if p["slug"] == slug), None)
    if not prod:
        sys.exit(f"Ürün bulunamadı: {slug}")
    raw = (AI_ROOT / prod["source_image"]).resolve()
    if not raw.exists():
        sys.exit(f"Kaynak foto yok: {raw}")
    SRC_DIR.mkdir(parents=True, exist_ok=True)
    out = SRC_DIR / f"{slug}.jpg"
    if out.exists():
        return out
    im = Image.open(raw).convert("RGB")
    w, h = im.size
    m = 1600
    if max(w, h) > m:
        if h >= w:
            im = im.resize((round(w * m / h), m), Image.LANCZOS)
        else:
            im = im.resize((m, round(h * m / w)), Image.LANCZOS)
    im.save(out, quality=90)
    print(f"  · kaynak küçültüldü → {out.name} {im.size}")
    return out


def generate(slug: str, ratios: list) -> None:
    if slug not in SCENES:
        sys.exit(f"Sahne tanımı yok: {slug}")
    product_ctx, scene = SCENES[slug]
    img = src_for(slug)
    out_dir = CREATIVES / slug
    out_dir.mkdir(parents=True, exist_ok=True)
    prompt = f"{scene}; {NOTEXT}"
    for name, ratio in RATIOS.items():
        if ratios and name not in ratios and ratio not in ratios:
            continue
        out = out_dir / f"{slug}-hf-scene-{name}.png"
        print(f"[{slug}] {name} ({ratio}) → Higgsfield…", flush=True)
        res = subprocess.run(
            ["higgsfield", "product-photoshoot", "create",
             "--mode", "lifestyle_scene", "--aspect_ratio", ratio, "--count", "1",
             "--product_context", product_ctx, "--brand_context", BRAND,
             "--prompt", prompt, "--image", str(img)],
            capture_output=True, text=True, timeout=900,
        )
        url = ""
        for line in (res.stdout or "").splitlines():
            line = line.strip()
            if line.startswith("https://") and line.endswith(".png"):
                url = line
        if not url:
            print(f"  ! URL alınamadı:\n{(res.stdout or '')[-400:]}\n{(res.stderr or '')[-400:]}")
            continue
        with urllib.request.urlopen(url, timeout=240) as r:
            out.write_bytes(r.read())
        print(f"  ✓ {out.relative_to(REKLAM)}", flush=True)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("slugs", nargs="*", help="ürün slug(ları); boş = 6 HD ürün")
    p.add_argument("--ratios", nargs="+", default=None,
                   help="feed/story/square veya 3:4/9:16/1:1 (boş = hepsi)")
    args = p.parse_args()
    slugs = args.slugs or list(SCENES.keys())
    for s in slugs:
        generate(s, args.ratios or [])
    print("\nBitti.")


if __name__ == "__main__":
    main()
