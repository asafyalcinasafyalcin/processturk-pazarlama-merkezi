#!/usr/bin/env python3
"""
Panel-odaklı Meta (Facebook/Instagram) Click-to-WhatsApp kampanya planı.

Pazarlama Komuta Merkezi (4181) "Reklama çık" akışı bunu çağırır. Sabit COPY yerine
KAYNAKTAN besler:
  - ürün/fiyat/spec     → Meta_Reklam_Sistemi/data/products.json (tek kaynak)
  - reklam metni        → panelin content.json'ı (fal any-llm ile üretilen varyantlar)
  - video creative      → content.json video URL'i (fal-hosted)

VARSAYILAN: --dry-run (token gerekmez) → kurulacak kampanya/ad set/creative/ad
yapısını üretir. Gerçek kurulum (PAUSED) için META_* token'ları + video upload gerekir;
bu güvenli şekilde kapı arkasındadır (create_meta_campaign.py ile aynı onay disiplini).

Kullanım:
  python3 panel_meta_campaign.py --slug granul-dolum --langs en fr --daily 6 \
      --content "../Processturk_Pazarlama_Merkezi/data/content.json" --emit-json
"""
import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # reklam/
APP_ROOT = ROOT.parent                                  # Processturk_Pazarlama_Merkezi/ (tek data/ + .env.local)
# Ürün verisi: PRODUCTS_JSON_PATH env > APP_ROOT/data/products.json (VPS/container uyumu)
PRODUCTS = Path(os.environ["PRODUCTS_JSON_PATH"]) if os.environ.get("PRODUCTS_JSON_PATH") \
    else APP_ROOT / "data" / "products.json"

# dil → hedef ülkeler (create_meta_campaign.py GEO'su + genişletme)
GEO = {
    "en": ["NG", "GH", "KE"],
    "fr": ["DZ", "MA", "TN", "SN", "CI"],
    "ar": ["DZ", "EG", "SA", "AE"],
    "ru": ["AZ", "KZ", "TM"],
    "tr": ["TR"],
}


def load_products() -> list:
    return json.loads(PRODUCTS.read_text(encoding="utf-8"))


def find_product(slug: str) -> dict:
    for p in load_products():
        if p.get("slug") == slug:
            return p
    sys.exit(f"Ürün bulunamadı: {slug}")


def load_content(content_path: str, slug: str) -> dict:
    if not content_path:
        return {}
    f = Path(content_path)
    if not f.exists():
        return {}
    data = json.loads(f.read_text(encoding="utf-8"))
    return data.get(slug, {}) or {}


def lang_copy(content: dict, lang: str) -> dict:
    """content.json'daki ilk varyantın (A) ilgili dil metnini al."""
    variants = (content.get("copy") or {}).get("variants") or []
    if not variants:
        return {}
    by_lang = variants[0].get("by_lang", {})
    return by_lang.get(lang, {}) or {}


def wa_link(number: str, prefill: str) -> str:
    import urllib.parse
    return f"https://wa.me/{number}?text=" + urllib.parse.quote(prefill)


def build_plan(slug: str, langs: list, daily: float, number: str, content: dict) -> dict:
    p = find_product(slug)
    name = p.get("name_en", slug)
    price = p.get("price_text", "")
    video_url = (content.get("video") or {}).get("url", "")
    reklam_tag = f"[REKLAM: PNL-{slug}]"

    ad_sets = []
    for lang in langs:
        c = lang_copy(content, lang)
        geo = GEO.get(lang, ["TR"])
        prefill = (c.get("cta") and f"{c.get('headline', name)} — {c.get('cta')}. {reklam_tag}") \
            or f"Hello, I'd like a quote for the {name}. {reklam_tag}"
        ad_sets.append({
            "name": f"PNL · {slug} · {lang.upper()} · CTWA",
            "lang": lang,
            "geo": geo,
            "optimization_goal": "CONVERSATIONS",
            "destination": "WHATSAPP",
            "daily_budget_usd": daily,
            "creative": {
                "type": "video" if video_url else "image",
                "video_url": video_url or None,
                "primary_text": c.get("primary", ""),
                "headline": c.get("headline", name),
                "description": c.get("description", price),
                "cta": "WHATSAPP_MESSAGE",
                "whatsapp_link": wa_link(number, prefill),
            },
        })

    return {
        "ok": True,
        "mode": "plan",
        "campaign": {
            "name": f"PNL · {slug} · CTWA",
            "objective": "OUTCOME_ENGAGEMENT",
            "status": "PAUSED",
        },
        "product": {"slug": slug, "name": name, "price": price},
        "reklam_tag": reklam_tag,
        "ad_sets": ad_sets,
        "notes": [
            "Bu bir PLAN'dır (dry-run). Hiçbir kampanya oluşturulmadı, harcama yok.",
            "Gerçek kurulum (PAUSED): .env.local'a META_ACCESS_TOKEN/META_AD_ACCOUNT_ID/META_PAGE_ID + video /advideos upload gerekir.",
            "Yayını yalnızca Asaf, Ads Manager'da elle başlatır.",
        ],
    }


# ── Gerçek kurulum (PAUSED) — yalnızca --no-dry-run + META_* token'larıyla ──

def _meta_env() -> dict:
    """create_meta_campaign.py ile aynı .env.local yükleme + kontrol."""
    env_file = next((p for p in (APP_ROOT / ".env.local", ROOT / ".env.local") if p.exists()), None)
    if env_file is not None:
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    miss = [k for k in ("META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID", "META_PAGE_ID") if not os.environ.get(k)]
    if miss:
        raise SystemExit("Eksik .env.local anahtarı: " + ", ".join(miss))
    acct = os.environ["META_AD_ACCOUNT_ID"]
    if not acct.startswith("act_"):
        acct = "act_" + acct
    return dict(token=os.environ["META_ACCESS_TOKEN"], acct=acct, page=os.environ["META_PAGE_ID"],
                ig=os.environ.get("META_IG_BUSINESS_ID", ""),
                ver=os.environ.get("META_API_VERSION", "v21.0"),
                wa=os.environ.get("WHATSAPP_NUMBER", "905527062723"))


def _graph_post(env, path, params):
    params = {k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in params.items()}
    params["access_token"] = env["token"]
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(f"https://graph.facebook.com/{env['ver']}/{path}", data=data, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


def _graph_get(env, path, fields):
    url = f"https://graph.facebook.com/{env['ver']}/{path}?fields={urllib.parse.quote(fields)}&access_token={urllib.parse.quote(env['token'])}"
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.loads(r.read().decode())


def create_real(slug, langs, daily, content) -> dict:
    """PAUSED kampanya + video creative kur. Yayını/harcamayı BAŞLATMAZ."""
    env = _meta_env()
    p = find_product(slug)
    video_url = (content.get("video") or {}).get("url", "")
    image_url = (content.get("image") or {}).get("url", "")
    if not video_url:
        raise SystemExit("Video yok — önce panelden video üret.")

    # 1) video upload (file_url) → işlenmesini bekle
    up = _graph_post(env, f"{env['acct']}/advideos", {"file_url": video_url, "name": f"PNL-{slug}"})
    video_id = up["id"]
    status = ""
    for _ in range(40):
        time.sleep(5)
        st = _graph_get(env, video_id, "status")
        status = (st.get("status") or {}).get("video_status", "")
        if status in ("ready", "error"):
            break
    if status != "ready":
        raise SystemExit(f"Video Meta'da işlenmedi (status={status or 'timeout'}).")

    # 2) kampanya (PAUSED)
    camp = _graph_post(env, f"{env['acct']}/campaigns", dict(
        name=f"PNL · {slug} · CTWA", objective="OUTCOME_ENGAGEMENT",
        status="PAUSED", special_ad_categories=[]))

    created = []
    daily_minor = int(round(float(daily) * 100))  # TRY → kuruş
    for lang in langs:
        c = lang_copy(content, lang)
        geo = GEO.get(lang, ["TR"])
        prefill = f"{c.get('headline', p['name_en'])} — {c.get('cta', 'WhatsApp')}. [REKLAM: PNL-{slug}]"
        wa = "https://wa.me/" + env["wa"] + "?text=" + urllib.parse.quote(prefill)

        adset = _graph_post(env, f"{env['acct']}/adsets", dict(
            name=f"AS-PNL-{slug}-{lang} · {'/'.join(geo)}", campaign_id=camp["id"], status="PAUSED",
            billing_event="IMPRESSIONS", optimization_goal="CONVERSATIONS",
            bid_strategy="LOWEST_COST_WITHOUT_CAP", destination_type="WHATSAPP", daily_budget=daily_minor,
            promoted_object={"page_id": env["page"]},
            targeting={"geo_locations": {"countries": geo}, "age_min": 25, "age_max": 55,
                       "publisher_platforms": ["facebook", "instagram"],
                       "targeting_automation": {"advantage_audience": 0}}))

        oss = {"page_id": env["page"]}
        if env.get("ig"):
            oss["instagram_user_id"] = env["ig"]
        video_data = {"video_id": video_id,
                      "message": c.get("primary", ""),
                      "title": c.get("headline", p["name_en"]),
                      "link_description": c.get("description", p.get("price_text", "")),
                      "call_to_action": {"type": "WHATSAPP_MESSAGE",
                                         "value": {"app_destination": "WHATSAPP", "link": wa}}}
        if image_url:
            video_data["image_url"] = image_url
        oss["video_data"] = video_data
        creative = _graph_post(env, f"{env['acct']}/adcreatives", dict(
            name=f"CR-PNL-{slug}-{lang}", object_story_spec=oss))
        ad = _graph_post(env, f"{env['acct']}/ads", dict(
            name=f"AD-PNL-{slug}-{lang}", adset_id=adset["id"],
            creative={"creative_id": creative["id"]}, status="PAUSED"))
        created.append({"lang": lang, "geo": geo, "adset_id": adset["id"],
                        "creative_id": creative["id"], "ad_id": ad["id"]})

    return {"ok": True, "mode": "created", "status": "PAUSED", "campaign_id": camp["id"],
            "video_id": video_id, "ad_sets": created,
            "notes": ["Kampanya PAUSED kuruldu — harcama YOK.",
                      "Yayını Ads Manager'da Asaf elle başlatır."]}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--slug", required=True)
    ap.add_argument("--langs", nargs="+", default=["en"])
    ap.add_argument("--daily", type=float, default=6.0)
    ap.add_argument("--number", default="905527062723")
    ap.add_argument("--content", default="")
    ap.add_argument("--emit-json", action="store_true", help="tek JSON objesi yazdır (API tüketimi)")
    ap.add_argument("--dry-run", action="store_true", default=True)
    ap.add_argument("--no-dry-run", dest="dry_run", action="store_false")
    args = ap.parse_args()

    content = load_content(args.content, args.slug)

    if not args.dry_run:
        # GERÇEK kurulum (PAUSED). Hata olursa JSON olarak döndür.
        try:
            plan = create_real(args.slug, args.langs, args.daily, content)
        except SystemExit as e:
            plan = {"ok": False, "error": str(e)}
        except Exception as e:  # noqa: BLE001
            plan = {"ok": False, "error": f"{type(e).__name__}: {e}"}
    else:
        plan = build_plan(args.slug, args.langs, args.daily, args.number, content)

    if args.emit_json:
        print(json.dumps(plan, ensure_ascii=False))
    else:
        print(json.dumps(plan, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
