#!/usr/bin/env python3
"""
Higgsfield lifestyle SAHNE üreteci (reklam görselleri).

Gerçek makine fotoğrafını referans verir (B4: gerçek makineyi koru, hayali üretme),
Higgsfield `product-photoshoot` (lifestyle_scene, gpt_image_2) ile ürünü çalışırken
gösteren premium bir sahne üretir. Makine yüzeyinde YAZI/LOGO/RAKAM yoktur — marka
katmanı (logo, fiyat, CTA) sonradan make_product overlay'i ile basılır.

Çıktılar eski cutout creative'lerini EZMEZ; `<slug>-hf-scene-<ratio>.png` adıyla
creatives/<slug>/ altına iner.

İki çalışma modu:
  1) Sabit liste (C1-hazir-makineler 6 HD ürün) — SCENES sözlüğünde tanımlı slug'lar,
     kaynak foto CENTER/data/products.json'dan (PRODUCTS listesi).
  2) Genel/config-tabanlı (ör. C3-uretim-hatlari hat ürünleri) — slug SCENES'te yoksa,
     campaigns/*/creatives/<slug>/config.json (klasör adı == slug ya da cfg['slug'] == slug)
     aranır; product_context = cfg['prep_prompt'], sahne = cfg['props_prompt'], kaynak foto
     yine PRODUCTS'tan (cfg['slug'] ile) çekilir. Çıktı doğrudan o creative klasörüne iner.

Konum: Processturk_Pazarlama_Merkezi/reklam/scripts/
Gerektirir: higgsfield CLI ($HOME/.local/bin), FAL gerekmez.

Kullanım:
  export PATH="$HOME/.local/bin:$PATH"
  python3 hf_scene.py                       # 6 HD ürün × 3 format
  python3 hf_scene.py granul-dolum          # tek ürün (sabit liste)
  python3 hf_scene.py granul-dolum --ratios feed
  python3 hf_scene.py salca-domates-isleme-hatti   # config-tabanlı (C3 vb.)
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

from PIL import Image
Image.MAX_IMAGE_PIXELS = None

# Marka motoru (Python) — _core/brands/<BRAND_ID>.json (env BRAND_ID). BRAND_ID yoksa
# ProcessTürk varsayılanı → canlı davranış korunur. Kod içinde sabit marka string'i KALMAZ.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from brand import BRAND as _BR   # noqa: E402

# Kaynak fotoğrafın uzun-kenar tavanı (küçültme). Eskiden 1600px SABİT'ti → premium'da
# bilgi kaybı (Asaf kalite şikayeti). Artık PARAMETRE: --max-edge CLI ya da HF_SCENE_MAX_EDGE
# env; 0 = küçültme YOK (orijinal çözünürlük). Varsayılan 2560 (HF upload'ın güvenli tavanı).
DEFAULT_MAX_EDGE = int(os.environ.get("HF_SCENE_MAX_EDGE", "2560"))

REKLAM = Path(__file__).resolve().parent.parent           # .../reklam
CENTER = REKLAM.parent                                     # .../Processturk_Pazarlama_Merkezi
AI_ROOT = CENTER.parent                                    # .../PROCESSTURK AI
# Ürün verisi: PRODUCTS_JSON_PATH env (kiracı-izole yol; Node bunu paths.js'ten geçirir)
# > CENTER/data/products.json (varsayılan/processturk). Panel bunu çağırırken env set eder.
_PRODUCTS_PATH = Path(os.environ["PRODUCTS_JSON_PATH"]) if os.environ.get("PRODUCTS_JSON_PATH") \
    else CENTER / "data" / "products.json"
PRODUCTS = json.loads(_PRODUCTS_PATH.read_text(encoding="utf-8"))
CREATIVES = REKLAM / "campaigns" / "C1-hazir-makineler" / "creatives"
SRC_DIR = REKLAM / "assets" / "hf-src"

# Meta formatları → Higgsfield product_photoshoot oranı (4:5 desteklenmiyor → 3:4)
RATIOS = {"feed": "3:4", "story": "9:16", "square": "1:1"}

# Marka bağlamı marka kaydından (brand.py) — BRAND_ID yoksa ProcessTürk varsayılanı.
BRAND = _BR["hf_brand_context"]
_N = _BR["name"]   # ürün bağlamlarında marka adı

# Makine yüzeyinde hiçbir yazı/logo/rakam olmasın — marka katmanını biz overlay ederiz.
NOTEXT = ("no text, no brand name, no logo, no readable labels, no digits anywhere on the "
          "machine body or its control panel — all machine surfaces clean and blank; keep "
          "uncluttered negative space at top and bottom for logo and price overlay; "
          "photo-real, premium, food-grade industrial workshop")

# Ürün-bazlı lifestyle senaryosu (slug → (product_context, scene_prompt)).
# product_context marka adıyla başlar → _N ile marka-farkındalıklı (f-string).
SCENES = {
    "granul-dolum": (
        f"{_N} 304 stainless steel semi-automatic granule filling machine actively "
        "filling small jars with colorful spices, nuts and pulses",
        "the real granule filling machine in action, filling clear jars with colorful dried "
        "spices, nuts and pulses pouring as motion, gloved hands placing a jar, warm "
        "professional lighting with subtle deep-navy brand tones",
    ),
    "sivi-dolum-hat": (
        f"{_N} stainless steel liquid filling line filling glass jars with golden honey, "
        "tahini and high-viscosity liquids on a production line",
        "the real liquid filling line in action, a clean golden stream of honey filling a row "
        "of glass jars on the line, gloved hands, modern food production hall, warm premium "
        "lighting with subtle deep-navy brand tones",
    ),
    "sivi-dolum-4nozul": (
        f"{_N} 4-nozzle stainless steel liquid filling machine filling multiple bottles "
        "simultaneously with liquid product, high capacity",
        "the real 4-nozzle liquid filling machine in action, four parallel streams filling "
        "bottles at once, dynamic high-capacity production line, modern food plant, warm "
        "premium lighting with subtle deep-navy brand tones",
    ),
    "etiketleme-oto": (
        f"{_N} full automatic labelling machine with cabin applying labels to bottles "
        "moving on a conveyor",
        "the real automatic labelling machine in action, glossy bottles moving on the conveyor "
        "as clean wrap-around labels are applied, modern bottling line, warm premium lighting "
        "with subtle deep-navy brand tones",
    ),
    "etiketleme-oto-304": (
        f"{_N} full automatic 304 stainless steel labelling machine with cabin labelling "
        "bottles on a hygienic food-grade line",
        "the real 304 stainless labelling machine with cabin in action, bottles moving through "
        "the stainless cabin as labels are applied, hygienic food-grade bottling line, warm "
        "premium lighting with subtle deep-navy brand tones",
    ),
    "etiketleme-304-kabinsiz": (
        f"{_N} full automatic 304 stainless steel labelling machine without cabin "
        "applying labels to bottles on a stainless platform",
        "the real 304 stainless labelling platform in action, bottles rotating as wrap-around "
        "labels are applied, open stainless line in a modern food workshop, warm premium "
        "lighting with subtle deep-navy brand tones",
    ),
}


def _find_creative_cfg(slug: str):
    """SCENES'te olmayan slug'lar için campaigns/*/creatives/<slug>/config.json arar
    (klasör adı == slug öncelikli, sonra cfg['slug'] == slug). (slug not in SCENES) →
    C3-uretim-hatlari gibi hat ürünleri için genel/config-tabanlı yol."""
    candidates = sorted(REKLAM.glob("campaigns/*/creatives/*/config.json"))
    for cfgp in candidates:
        if cfgp.parent.name == slug:
            try:
                return cfgp.parent, json.loads(cfgp.read_text(encoding="utf-8"))
            except Exception:
                continue
    for cfgp in candidates:
        try:
            c = json.loads(cfgp.read_text(encoding="utf-8"))
        except Exception:
            continue
        if c.get("slug") == slug:
            return cfgp.parent, c
    return None, None


def src_for(slug: str, max_edge: int = DEFAULT_MAX_EDGE) -> Path:
    """products.json'daki source_image'i uzun-kenar <= max_edge olacak şekilde JPG'e hazırlar.
    max_edge=0 → küçültme YOK (orijinal çözünürlük). Kalite: premium'da yüksek çözünürlük korunur.
    (Eskiden 1600px SABİT idi; darboğaz açıldı — bkz. DEFAULT_MAX_EDGE.)"""
    prod = next((p for p in PRODUCTS if p["slug"] == slug), None)
    if not prod:
        sys.exit(f"Ürün bulunamadı: {slug}")
    rel = prod["source_image"]
    # source_image tabanı products.json girdisine göre değişir: eski AI_ROOT-göreli tam yol
    # (ör. "Processturk_Satis_Dolum_Makinaları/...") ya da site-eşitlemeli CENTER-göreli
    # "data/uploads/..." — ikisini de dene (AI_ROOT önce, sonra CENTER).
    raw = None
    for base in (AI_ROOT, CENTER):
        cand = (base / rel).resolve()
        if cand.exists():
            raw = cand
            break
    if raw is None:
        sys.exit(f"Kaynak foto yok: {rel} (aranan: {(AI_ROOT / rel)} , {(CENTER / rel)})")
    SRC_DIR.mkdir(parents=True, exist_ok=True)
    # Farklı max_edge değerlerinin önbelleği çakışmasın (1600 çıktısı 2560'ı gölgelemesin).
    tag = "orig" if max_edge <= 0 else str(max_edge)
    out = SRC_DIR / f"{slug}-{tag}.jpg"
    if out.exists():
        return out
    im = Image.open(raw).convert("RGB")
    w, h = im.size
    if max_edge > 0 and max(w, h) > max_edge:
        m = max_edge
        if h >= w:
            im = im.resize((round(w * m / h), m), Image.LANCZOS)
        else:
            im = im.resize((m, round(h * m / w)), Image.LANCZOS)
        print(f"  · kaynak {max_edge}px'e küçültüldü → {out.name} {im.size}")
    else:
        print(f"  · kaynak korundu (küçültme yok) → {out.name} {im.size}")
    im.save(out, quality=92)
    return out


def generate(slug: str, ratios: list, max_edge: int = DEFAULT_MAX_EDGE) -> None:
    if slug in SCENES:
        product_ctx, scene = SCENES[slug]
        img = src_for(slug, max_edge)
        out_dir = CREATIVES / slug
    else:
        cdir, cfg = _find_creative_cfg(slug)
        if not cdir:
            sys.exit(f"Sahne tanımı yok: {slug} (SCENES'te yok, campaigns/*/creatives/ altında "
                      f"config.json da bulunamadı)")
        prep = (cfg.get("prep_prompt") or "").strip()
        props = (cfg.get("props_prompt") or "").strip()
        if not prep or not props:
            sys.exit(f"{slug}: config.json'da prep_prompt/props_prompt eksik.")
        product_ctx, scene = prep, props
        img_slug = cfg.get("slug", slug)
        img = src_for(img_slug, max_edge)   # gerçek/site ürün fotoğrafı (data/products.json)
        out_dir = cdir
        slug = img_slug   # dosya adı öneki cfg['slug'] ile tutarlı olsun (overlay/kampanya beklentisi)
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
    p.add_argument("--max-edge", type=int, default=DEFAULT_MAX_EDGE,
                   help=f"kaynak foto uzun-kenar tavanı px (0 = küçültme yok/orijinal; vars. {DEFAULT_MAX_EDGE})")
    args = p.parse_args()
    slugs = args.slugs or list(SCENES.keys())
    for s in slugs:
        generate(s, args.ratios or [], args.max_edge)
    print("\nBitti.")


if __name__ == "__main__":
    main()
