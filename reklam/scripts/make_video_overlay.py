#!/usr/bin/env python3
"""
Video marka overlay burn-in — fiyat / başlık / CTA / logo (marka kaydından).

Üretilen ham ürün videosunun (panel fal.ai çıktısı, ör. public/renders/<slug>-*.mp4)
üzerine, statik creative'lerle AYNI tasarım sistemiyle (marka navy + red renkleri,
başlık/gövde fontları) şeffaf bir marka katmanı bindirir. Katman templates/video-overlay.html
ile Chrome'da şeffaf PNG olarak render edilir, sonra ffmpeg ile videoya gömülür.

Metin kaynağı = creative config.json'un languages bloğu (statik creative ile tek kaynak):
  badges[0] · name · price_pre · price_num · sub · cta   (+ rtl bayrağı)

Kullanım:
  python3 make_video_overlay.py <config.json> --video <giris.mp4> [--lang en] [--out <cikis.mp4>]
  python3 make_video_overlay.py campaigns/.../granul-dolum/config.json \
      --video ../public/renders/granul-dolum-tr-...mp4 --lang en
"""
import argparse
import html
import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_product as mp  # SIZES, find_browser
from brand import BRAND as _BR  # marka motoru (env BRAND_ID)

ROOT = Path(__file__).resolve().parent.parent           # reklam/
TEMPLATE = ROOT / "templates" / "video-overlay.html"


def _probe(video: Path) -> tuple[int, int]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", str(video)],
        capture_output=True, text=True,
    ).stdout.strip()
    w, h = (int(x) for x in out.split("x")[:2])
    return w, h


def _has_audio(video: Path) -> bool:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries",
         "stream=index", "-of", "csv=p=0", str(video)],
        capture_output=True, text=True,
    ).stdout.strip()
    return bool(out)


def _size_key(w: int, h: int) -> str:
    r = w / h
    if r < 0.85:
        return "story"
    if r > 1.15:
        return "feed"
    return "square"


def render_overlay_png(tx: dict, w: int, h: int, out_png: Path, lang: str, rtl: bool,
                       top: bool = True) -> Path:
    """video-overlay.html'i video çözünürlüğünde ŞEFFAF PNG olarak render et."""
    base = mp.SIZES[_size_key(w, h)]
    scale = h / base["H"]                       # font ölçülerini gerçek yüksekliğe oranla
    px = lambda k: max(1, round(base[k] * scale))

    tpl = TEMPLATE.read_text(encoding="utf-8")
    repl = {
        "__W__": w, "__H__": h, "__PAD__": px("pad"), "__BADGE__": px("badge"),
        "__BRAND__": px("name") // 2, "__GAP__": px("gap"), "__PRICEPRE__": px("price_pre"),
        "__PRICE__": px("price"), "__HEAD__": px("name"), "__SUB__": px("sub"),
        "__CTAMT__": px("ctamt"), "__CTA__": px("cta"), "__RAD__": px("rad"),
        "__TOPDISP__": "flex" if top else "none",
    }
    for k, v in repl.items():
        tpl = tpl.replace(k, str(v))
    badge0 = (tx.get("badges") or [""])[0]
    tpl = (tpl
           # Video overlay markası: video_navy/video_red (Asaf v2.1) + marka adı — white-label.
           .replace("__NAVY__", _BR["video_navy"])
           .replace("__RED__", _BR["video_red"])
           .replace("__BRAND_NAME__", html.escape(_BR["name"]))
           .replace("__LANG__", html.escape(lang))
           .replace("__DIR__", "rtl" if rtl else "ltr")
           .replace("__BADGE_TEXT__", html.escape(badge0))
           .replace("__PRICEPRE_TEXT__", html.escape(tx.get("price_pre", "")))
           .replace("__PRICE_TEXT__", html.escape(tx.get("price_num", "")))
           .replace("__HEAD_TEXT__", html.escape(tx.get("name", "")))
           .replace("__SUB_TEXT__", html.escape(tx.get("sub", "")))
           .replace("__CTA_TEXT__", html.escape(tx.get("cta", ""))))

    out_png.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as tf:
        tf.write(tpl)
        tmp = Path(tf.name)
    res = subprocess.run(
        [mp.find_browser(), "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
         "--force-device-scale-factor=1", "--default-background-color=00000000",
         "--virtual-time-budget=4000", f"--window-size={w},{h}",
         f"--screenshot={out_png}", tmp.as_uri()],
        capture_output=True, text=True, timeout=90,
    )
    tmp.unlink(missing_ok=True)
    if res.returncode != 0 or not out_png.exists():
        sys.exit(f"Overlay render başarısız:\n{res.stderr.strip()}")
    return out_png


def burn(video: Path, overlay_png: Path, out: Path) -> Path:
    cmd = ["ffmpeg", "-y", "-i", str(video), "-i", str(overlay_png),
           "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto",
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
           "-movflags", "+faststart"]
    if _has_audio(video):
        cmd += ["-c:a", "copy"]
    cmd.append(str(out))
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0 or not out.exists():
        sys.exit(f"ffmpeg burn-in başarısız:\n{res.stderr[-1200:]}")
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("config", type=Path)
    p.add_argument("--video", type=Path, required=True, help="Ham giriş videosu (mp4)")
    p.add_argument("--lang", default=None, help="Hangi dil bloğu (vars. config'teki ilk dil)")
    p.add_argument("--out", type=Path, default=None, help="Çıkış mp4 (vars. <giris>-<lang>-brand.mp4)")
    p.add_argument("--keep-png", action="store_true", help="Ara overlay PNG'sini silme")
    p.add_argument("--no-top", action="store_true",
                   help="Üst satırı (badge + marka logosu) atla — video zaten markalıysa kullan")
    args = p.parse_args()

    cfg = json.loads(args.config.resolve().read_text(encoding="utf-8"))
    slug = cfg.get("slug", args.config.parent.name)
    languages = cfg.get("languages") or {cfg.get("lang", "tr"): cfg}
    lang = args.lang or next(iter(languages))
    if lang not in languages:
        sys.exit(f"Dil '{lang}' config'te yok. Mevcut: {', '.join(languages)}")
    tx = languages[lang]
    rtl = bool(tx.get("rtl"))

    video = args.video.resolve()
    if not video.exists():
        sys.exit(f"Video bulunamadı: {video}")
    w, h = _probe(video)
    out = (args.out or video.with_name(f"{video.stem}-{lang}-brand.mp4")).resolve()
    png = out.with_suffix(".overlay.png")

    print(f"[1/2] Overlay render · {slug}/{lang} · {w}x{h} ({_size_key(w,h)})")
    render_overlay_png(tx, w, h, png, lang, rtl, top=not args.no_top)
    print(f"[2/2] ffmpeg burn-in → {out.name}")
    burn(video, png, out)
    if not args.keep_png:
        png.unlink(missing_ok=True)
    print(f"\nHazır: {out}")


if __name__ == "__main__":
    main()
