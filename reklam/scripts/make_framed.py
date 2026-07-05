#!/usr/bin/env python3
"""
"Çerçeveli kart" reklam üreteci (v3) — TÜM ürünler için standart marka düzeni.

Tek master ürün fotoğrafından (3:4 ya da dikey ürün çekimi) her formatta markalı
reklam basar: bulanık zemin + ortada tam ürün (kırpısız) + üst/alt marka katmanı.
Story (9:16) yerleşiminde platform arayüzü (IG başlığı / Meta WhatsApp butonu) görselin
ÜSTÜNE bindiği için üst ~%14 ve alt ~%19 GÜVENLİ ALAN boş bırakılır. Feed (4:5) ve
square (1:1) feed yerleşimine gider → arayüz görselin DIŞINDA → güvenli alan gerekmez.

Master sahne çözümleme sırası (ilk bulunan):
  --scene <yol> > creatives/<slug>/<slug>-scene.png > assets/hf-src/<slug>-scene-real.png
  > creatives/<slug>/<slug>-hf-scene-feed.png > config.source_image (AI kökünden)

Kullanım:
  python3 make_framed.py <creative_config.json>
  python3 make_framed.py <config.json> --sizes feed story --langs en fr
  python3 make_framed.py <config.json> --scene /yol/master.png
"""
import argparse, html, json, subprocess, sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_product as mp  # SIZES (W/H), find_browser, ensure_white_logo

ROOT = Path(__file__).resolve().parent.parent              # reklam/
AI_ROOT = ROOT.parent.parent                               # PROCESSTURK AI/
TEMPLATE = ROOT / "templates" / "product-framed.html"
# Framed = varsayılan (kredisiz) creative. Site/renk/ad marka kaydından (white-label).
SITE = mp.BRAND_REPL["__SITE__"]

# Format başına düzen parametreleri.
#   st/sb : story'de platform güvenli alanı (px). feed/square'de sadece normal kenar boşluğu.
#   fgmax : ortadaki kartın (ürün fotoğrafı) maksimum yüksekliği (px).
FMT = {
    "feed":   dict(st=40,  sb=40,  fgmax=720, name=54, price=58, pre=30, badge=20, sub=23, trust=20, cta=26, align="center"),
    "story":  dict(st=280, sb=360, fgmax=900, name=50, price=54, pre=28, badge=20, sub=23, trust=20, cta=25, align="stretch"),
    "square": dict(st=36,  sb=36,  fgmax=540, name=42, price=46, pre=25, badge=18, sub=22, trust=19, cta=24, align="center"),
}


def resolve_scene(slug, out_dir, cfg, override):
    cands = []
    if override:
        cands.append(override)
    cands += [
        out_dir / f"{slug}-scene.png",
        ROOT / "assets" / "hf-src" / f"{slug}-scene-real.png",
        out_dir / f"{slug}-hf-scene-feed.png",
    ]
    if cfg.get("source_image"):
        cands.append(AI_ROOT / cfg["source_image"])
    for c in cands:
        if c and Path(c).exists():
            return Path(c)
    sys.exit(f"Master sahne bulunamadı. Denenen: " + ", ".join(str(c) for c in cands))


def render(tx: dict, size: str, scene: Path, logo: Path, out: Path, lang: str, rtl: bool) -> Path:
    s = mp.SIZES[size]; f = FMT[size]
    badge_line = " · ".join(html.escape(b) for b in tx.get("badges", [])[:3])
    tpl = TEMPLATE.read_text(encoding="utf-8")
    repl = {
        "__LANG__": html.escape(lang), "__DIR__": "rtl" if rtl else "ltr",
        "__W__": s["W"], "__H__": s["H"],
        "__ST__": f["st"], "__SB__": f["sb"], "__FGMAX__": f["fgmax"], "__ALIGN__": f["align"],
        "__BADGE_FS__": f["badge"], "__NAME_FS__": f["name"], "__PRICE_FS__": f["price"],
        "__PRICE_PRE_FS__": f["pre"], "__SUB_FS__": f["sub"], "__TRUST_FS__": f["trust"], "__CTA_FS__": f["cta"],
        "__BADGE_LINE__": badge_line,
        # A konsepti name/trust kullanır; B konsepti (config-b.json) hero/brands kullanır → otomatik fallback
        "__NAME__": html.escape(tx.get("name") or tx.get("hero") or ""),
        "__PRICE_PRE__": html.escape(tx.get("price_pre", "")),
        "__PRICE_NUM__": html.escape(tx.get("price_num", "")),
        "__SUB__": html.escape(tx.get("sub", "")),
        "__TRUST__": html.escape(tx.get("trust") or tx.get("brands") or ""),
        "__CTA__": html.escape(tx.get("cta", "")),
        "__SITE__": html.escape(SITE),
        "__NAVY__": mp.BRAND_REPL["__NAVY__"],
        "__RED__": mp.BRAND_REPL["__RED__"],
        "__BRAND__": html.escape(mp.BRAND_REPL["__BRAND__"]),
        "__BRAND_NAME__": html.escape(mp.BRAND_REPL["__BRAND_NAME__"]),
        "__SCENE__": scene.resolve().as_uri(),
        "__LOGO__": logo.resolve().as_uri(),
    }
    for k, v in repl.items():
        tpl = tpl.replace(k, str(v))
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as tf:
        tf.write(tpl); tmp = Path(tf.name)
    res = subprocess.run(
        [mp.find_browser(), "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
         "--force-device-scale-factor=1", "--virtual-time-budget=8000",
         f"--window-size={s['W']},{s['H']}", f"--screenshot={out}", tmp.as_uri()],
        capture_output=True, text=True, timeout=120)
    tmp.unlink(missing_ok=True)
    if res.returncode != 0 or not out.exists():
        sys.exit(f"Render başarısız ({lang}/{size}):\n{res.stderr.strip()[:400]}")
    print(f"  · {out.name}")
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("config", type=Path)
    p.add_argument("--scene", type=Path, default=None, help="Master ürün fotoğrafı (zorunlu değil)")
    p.add_argument("--sizes", nargs="+", default=None)
    p.add_argument("--langs", nargs="+", default=None)
    p.add_argument("--variant", default=None,
                   help="Dosya adına ek (B konsepti için 'b' → <slug>-b-framed-...). Verilmezse config.variant.")
    args = p.parse_args()

    cfg_path = args.config.resolve()
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    out_dir = cfg_path.parent
    slug = cfg.get("slug", out_dir.name)
    variant = args.variant or cfg.get("variant") or ""
    vpre = f"-{variant}" if variant else ""   # A: ''  ·  B: '-b' → <slug>-b-framed-...

    logo = mp.ensure_white_logo()
    scene = resolve_scene(slug, out_dir, cfg, args.scene)
    print(f"[i] Master sahne: {scene}")

    sizes = args.sizes or cfg.get("sizes", ["feed", "story", "square"])
    languages = cfg.get("languages") or {cfg.get("lang", "tr"): cfg}
    if args.langs:
        languages = {k: v for k, v in languages.items() if k in args.langs}

    outs = []
    for code, tx in languages.items():
        rtl = bool(tx.get("rtl"))
        for size in sizes:
            out = out_dir / f"{slug}{vpre}-framed-{code}-{size}.png"
            render(tx, size, scene, logo, out, lang=code, rtl=rtl)
            outs.append(out)
    print("\nHazır:")
    for o in outs:
        print(" ", o.name)


if __name__ == "__main__":
    main()
