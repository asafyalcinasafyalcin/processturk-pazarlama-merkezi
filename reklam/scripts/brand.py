#!/usr/bin/env python3
"""
Python tarafı marka motoru — JS lib/brand.js'in eşdeğeri.

Marka kimliği tek kaynaktan: _core/brands/<BRAND_ID>.json (env BRAND_ID, varsayılan
'processturk'). JSON okunamazsa ProcessTürk varsayılanına düşer → BRAND_ID set değilse
canlı davranış birebir korunur (regresyon yok). Reklam scriptleri (hf_scene, make_ad_preview,
panel_meta_campaign) buradan okur; kodda sabit "ProcessTürk"/renk/numara KALMAZ.
"""
import json
import os
from pathlib import Path

# .../Processturk_Pazarlama_Merkezi/reklam/scripts/brand.py
_SCRIPTS = Path(__file__).resolve().parent
_CENTER = _SCRIPTS.parent.parent                 # .../Processturk_Pazarlama_Merkezi
_AI_ROOT = _CENTER.parent                        # .../PROCESSTURK AI
_BRANDS = _AI_ROOT / "_core" / "brands"

# ProcessTürk varsayılanı (JSON'da eksik alan bu değere düşer).
_DEFAULTS = {
    "name": "ProcessTürk",
    "whatsapp": "905527062723",
    "web": "processturk.com",
    "navy": "#071739",          # panel/statik reklam creative teması
    "red": "#FF3255",
    "video_navy": "#1A2B5F",    # video overlay (Asaf v2.1 kuralı)
    "video_red": "#D71920",
    "logo_white": "processturk-logo-white.png",
    "wordmark_white": "processturk-wordmark-white.png",
    "satinalma_logo": "processturk-logo.png",
    "page_name": "ProcessTürk",
    "hf_brand_context": (
        "ProcessTürk — Turkish industrial machinery manufacturer; brand colors deep "
        "navy #1A2B5F and red #D71920; premium, trustworthy, technical B2B"
    ),
}


def _load_record(brand_id=None):
    bid = brand_id or os.environ.get("BRAND_ID", "processturk")
    try:
        return json.loads((_BRANDS / f"{bid}.json").read_text(encoding="utf-8"))
    except Exception:
        return {}


def get_brand(brand_id=None):
    """Marka değerlerini düz sözlük olarak döndürür (eksikler ProcessTürk varsayılanına düşer)."""
    r = _load_record(brand_id)
    colors = r.get("colors", {}) or {}
    contact = r.get("contact", {}) or {}
    mk = r.get("marketing", {}) or {}
    name = r.get("name") or _DEFAULTS["name"]
    navy = colors.get("navy") or _DEFAULTS["navy"]
    red = colors.get("red") or _DEFAULTS["red"]
    video_navy = colors.get("videoNavy") or _DEFAULTS["video_navy"]
    video_red = colors.get("videoRed") or _DEFAULTS["video_red"]
    return {
        "id": r.get("id", "processturk"),
        "name": name,
        # env WHATSAPP_NUMBER > marka kaydı > varsayılan (JS ile aynı öncelik)
        "whatsapp": os.environ.get("WHATSAPP_NUMBER") or contact.get("whatsapp") or _DEFAULTS["whatsapp"],
        "web": r.get("web") or r.get("domain") or _DEFAULTS["web"],
        "navy": navy,
        "red": red,
        "video_navy": video_navy,
        "video_red": video_red,
        "logo_white": mk.get("logoWhite") or _DEFAULTS["logo_white"],
        "wordmark_white": mk.get("wordmarkWhite") or _DEFAULTS["wordmark_white"],
        "satinalma_logo": mk.get("satinalmaLogo") or _DEFAULTS["satinalma_logo"],
        "page_name": mk.get("pageName") or mk.get("promptName") or name,
        "prompt_name": mk.get("promptName") or name,
        "hf_brand_context": mk.get("hfBrandContext") or (
            f"{name} — Turkish industrial machinery manufacturer; brand colors deep "
            f"navy {video_navy} and red {video_red}; premium, trustworthy, technical B2B"
        ),
    }


# Modül seviyesinde tek instance (import edip BRAND['name'] gibi kullan).
BRAND = get_brand()


if __name__ == "__main__":
    import sys
    bid = sys.argv[1] if len(sys.argv) > 1 else None
    print(json.dumps(get_brand(bid), ensure_ascii=False, indent=2))
