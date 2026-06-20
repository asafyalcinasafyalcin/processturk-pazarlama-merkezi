#!/usr/bin/env python3
"""
Meta (Facebook/Instagram) Click-to-WhatsApp kampanyasını Marketing API ile **PAUSED**
(duraklatılmış) olarak kurar. Yayını/harcamayı BAŞLATMAZ — Asaf Ads Manager'da "yayınla"ya
basar. "Sen kurgula, ben çalıştırırım" yolu: tek komut → kampanya + 2 ad set (EN/FR) + creative + ad.

Akış (graph.facebook.com):
  1) campaign (OUTCOME_ENGAGEMENT, PAUSED)
  2) her dil için ad set (optimization CONVERSATIONS, destination WHATSAPP, geo=dil bölgesi, PAUSED)
  3) creative görselini /adimages'a yükle → image_hash
  4) ad creative (object_story_spec + WHATSAPP_MESSAGE CTA, link = wa.me?text=<prefill+[REKLAM:] etiket>)
  5) ad (PAUSED)

Kimlik bilgileri .env.local'dan (koda yazılmaz):
  META_ACCESS_TOKEN   (ads_management + pages_* + whatsapp_business_management scope'lu uzun-ömürlü token)
  META_AD_ACCOUNT_ID  (act_ önekli ya da sadece sayı)
  META_PAGE_ID        (reklamı yayınlayacak Facebook Sayfası ID'si; WhatsApp numarası buna bağlı olmalı)
  META_API_VERSION    (opsiyonel, vars. v21.0)
  WHATSAPP_NUMBER     (opsiyonel, vars. 905527062723)

Kullanım:
  python3 create_meta_campaign.py campaigns/.../creatives/granul-dolum/config.json --daily 3 --dry-run
  python3 create_meta_campaign.py campaigns/.../creatives/granul-dolum/config.json --daily 3   # gerçek kurulum (PAUSED)
"""
import argparse
import json
import mimetypes
import os
import sys
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


def _urlopen_retry(req, timeout: int, tries: int = 4):
    """urlopen + geçici ağ hatalarında (URLError/reset) yeniden dene. HTTPError yükselir (API hatası)."""
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError:
            raise                          # API hatası → çağıran ele alır
        except (urllib.error.URLError, OSError) as ex:
            last = ex
            if i < tries - 1:
                time.sleep(2 * (i + 1))    # 2s, 4s, 6s backoff
    raise last

ROOT = Path(__file__).resolve().parent.parent   # reklam/
APP_ROOT = ROOT.parent                           # Processturk_Pazarlama_Merkezi/ (tek .env.local + data/)

# Dile göre WhatsApp ön-dolu mesaj kalıbı (chatbot dili buradan anlar). {name} = yerel ürün adı.
PREFILL_TMPL = {
    "en": "Hello, I'd like the model and price for the {name}.",
    "fr": "Bonjour, je souhaite le modèle et le prix de {name}.",
    "ar": "مرحبًا، أريد معرفة الموديل والسعر لـ {name}.",
    "ru": "Здравствуйте, хочу узнать модель и цену {name}.",
}
# Bağlaç: fiyat ifadesi config'te price_pre olarak zaten dilde ("Starting from"/"À partir de"/"От"/"تبدأ من").


def _product_name(tx: dict) -> str:
    """Yerel ürün adı: Concept A'da name; Concept B'de sub'ın ilk parçası (ör. 'Granular Filling Machine')."""
    if tx.get("name"):
        return tx["name"]
    sub = tx.get("sub", "")
    return sub.split("·")[0].strip() if sub else "machine"


def _creative_text(tx: dict, tag: str) -> dict:
    """Creative metnini config'in dil bloğundan üretir (tek kaynak). Concept A (name) ya da B (hero) otomatik.
    Açık override: tx içinde primary/headline/description varsa onlar kullanılır."""
    name = _product_name(tx)
    price = (tx.get("price_pre", "") + " " + tx.get("price_num", "")).strip()
    hero = tx.get("hero")                      # Concept B kalite başlığı
    brands = tx.get("brands", "")              # ör. Siemens · Schneider · Festo
    sub = tx.get("sub", "")
    badges = " · ".join(tx.get("badges", [])[:3])
    if hero:                                   # Concept B (kalite/menşei)
        headline = tx.get("headline") or hero
        primary = tx.get("primary") or f"{hero} {brands}. {sub}. {price}.".replace("  ", " ").strip()
    else:                                      # Concept A (ürün+fiyat)
        headline = tx.get("headline") or (f"{name} — {price}".strip(" —"))
        primary = tx.get("primary") or f"{name}. {sub}. {price}.".replace("  ", " ").strip()
    description = tx.get("description") or badges or price
    prefill = PREFILL_TMPL.get(tx.get("_lang", "en"), PREFILL_TMPL["en"]).format(name=name) + f" [REKLAM: {tag}]"
    return dict(primary=primary, headline=headline, description=description, prefill=prefill)


def _env() -> dict:
    """.env.local'dan META_* anahtarlarını yükle (fal_image.load_env deseni)."""
    env_file = next((p for p in (APP_ROOT / ".env.local", ROOT / ".env.local") if p.exists()), None)
    if env_file is not None:
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    miss = [k for k in ("META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID", "META_PAGE_ID")
            if not os.environ.get(k)]
    if miss:
        sys.exit("Eksik .env.local anahtarı: " + ", ".join(miss) +
                 "\n(META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_PAGE_ID gerekli — değerleri Asaf girer.)")
    acct = os.environ["META_AD_ACCOUNT_ID"]
    if not acct.startswith("act_"):
        acct = "act_" + acct
    return dict(
        token=os.environ["META_ACCESS_TOKEN"],
        acct=acct,
        page=os.environ["META_PAGE_ID"],
        ig=os.environ.get("META_INSTAGRAM_ID", ""),   # IG yerleşimleri için sayfaya bağlı IG hesabı
        ver=os.environ.get("META_API_VERSION", "v21.0"),
        wa=os.environ.get("WHATSAPP_NUMBER", "905527062723"),
    )


class Graph:
    def __init__(self, env: dict, dry: bool):
        self.e = env
        self.dry = dry

    def _url(self, path: str) -> str:
        return f"https://graph.facebook.com/{self.e['ver']}/{path}"

    def post(self, path: str, params: dict) -> dict:
        params = {k: (json.dumps(v) if isinstance(v, (dict, list)) else v)
                  for k, v in params.items()}
        params["access_token"] = self.e["token"]
        if self.dry:
            safe = {k: v for k, v in params.items() if k != "access_token"}
            print(f"  [dry-run] POST {path}\n           {json.dumps(safe, ensure_ascii=False)[:500]}")
            return {"id": f"DRYRUN_{uuid.uuid4().hex[:8]}"}
        data = urllib.parse.urlencode(params).encode()
        req = urllib.request.Request(self._url(path), data=data, method="POST")
        try:
            return json.loads(_urlopen_retry(req, 120).decode())
        except urllib.error.HTTPError as ex:
            sys.exit(f"Meta API hata {ex.code} ({path}):\n{ex.read().decode('utf-8','ignore')[:800]}")

    def upload_image(self, img: Path) -> str:
        if self.dry:
            print(f"  [dry-run] /adimages upload {img.name}")
            return f"DRYHASH_{uuid.uuid4().hex[:8]}"
        boundary = "----ptk" + uuid.uuid4().hex
        mime = mimetypes.guess_type(str(img))[0] or "image/png"
        body = bytearray()
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="access_token"\r\n\r\n{self.e["token"]}\r\n'.encode()
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="filename"; filename="{img.name}"\r\n'.encode()
        body += f"Content-Type: {mime}\r\n\r\n".encode()
        body += img.read_bytes() + b"\r\n"
        body += f"--{boundary}--\r\n".encode()
        req = urllib.request.Request(
            self._url(f"{self.e['acct']}/adimages"), data=bytes(body), method="POST",
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
        try:
            res = json.loads(_urlopen_retry(req, 180).decode())
        except urllib.error.HTTPError as ex:
            sys.exit(f"Görsel yükleme hata {ex.code}:\n{ex.read().decode('utf-8','ignore')[:800]}")
        # {"images": {"<name>": {"hash": "..."}}}
        return next(iter(res["images"].values()))["hash"]


def _asset_feed_spec(hashes: dict, copy: dict, wa_link: str) -> dict:
    """Placement'a göre çok-format (4:5 feed · 9:16 story/reels · 1:1 square) tek-görsel creative.
    Eksik format olursa o kuralı atlar; feed her zaman default. Standart geliştirmeler API'den
    toplu kapatılamıyor (Meta kaldırdı) → marka korumasını açık placement görselleri sağlar."""
    images, rules = [], []
    if "feed" in hashes:
        images.append({"hash": hashes["feed"], "adlabels": [{"name": "img_feed"}]})
    if "story" in hashes:
        images.append({"hash": hashes["story"], "adlabels": [{"name": "img_story"}]})
        rules.append({"customization_spec": {
            "publisher_platforms": ["facebook", "instagram"],
            "facebook_positions": ["story", "facebook_reels"],
            "instagram_positions": ["story", "reels"]},
            "image_label": {"name": "img_story"}})
    if "square" in hashes:
        images.append({"hash": hashes["square"], "adlabels": [{"name": "img_square"}]})
        rules.append({"customization_spec": {
            "publisher_platforms": ["instagram"], "instagram_positions": ["stream", "explore"]},
            "image_label": {"name": "img_square"}})
    # feed = default (kalan tüm yerleşimler)
    rules.append({"customization_spec": {
        "publisher_platforms": ["facebook", "instagram", "audience_network", "messenger"]},
        "image_label": {"name": "img_feed"}, "is_default": True})
    return {
        "ad_formats": ["SINGLE_IMAGE"], "optimization_type": "PLACEMENT",
        "images": images,
        "bodies": [{"text": copy["primary"]}],
        "titles": [{"text": copy["headline"]}],
        "descriptions": [{"text": copy["description"]}],
        "link_urls": [{"website_url": wa_link}],
        "call_to_action_types": ["WHATSAPP_MESSAGE"],
        "asset_customization_rules": rules,
    }


def build_unit(g: "Graph", env: dict, camp_id: str, slug: str, lang: str, geo: list,
               copy: dict, file_suffix: str, daily_minor: int, out_dir: Path, label: str) -> bool:
    """Tek ad set + çok-format creative + ad (PAUSED) kurar. label = ad set adı eki (A-EN gibi)."""
    if not copy:
        print(f"  · {label}: COPY tanımsız, atlandı (script'e ekle)"); return False
    imgs = {fmt: out_dir / f"{slug}{file_suffix}-{lang}-{fmt}.png" for fmt in ("feed", "story", "square")}
    if not imgs["feed"].exists():
        print(f"  · {label}: feed görseli yok ({imgs['feed'].name}), atlandı"); return False

    adset = g.post(f"{env['acct']}/adsets", dict(
        name=f"AS-{label} · {'/'.join(geo)}",
        campaign_id=camp_id, status="PAUSED",
        billing_event="IMPRESSIONS", optimization_goal="CONVERSATIONS",
        bid_strategy="LOWEST_COST_WITHOUT_CAP",   # teklif tutarı gerektirmez (en düşük maliyet)
        destination_type="WHATSAPP", daily_budget=daily_minor,
        promoted_object={"page_id": env["page"]},
        targeting={"geo_locations": {"countries": geo}, "age_min": 25, "age_max": 55,
                   "publisher_platforms": ["facebook", "instagram"],
                   "targeting_automation": {"advantage_audience": 0}}))   # sabit kitle (A/B kontrollü)
    print(f"  ✓ adset {adset['id']} ({label} → {','.join(geo)})")

    hashes = {fmt: g.upload_image(p) for fmt, p in imgs.items() if p.exists()}
    # Zengin atıf: rota etiketi [REKLAM: ...] AYNI kalır (chatbot okur) + ref kodu (CRM atıf)
    ref = f"{slug}-{label.lower()}"            # ör. granul-dolum-a-en
    wa_link = "https://wa.me/" + env["wa"] + "?text=" + urllib.parse.quote(
        copy["prefill"] + f" [ref: {ref}]")
    oss = {"page_id": env["page"]}
    if env.get("ig"):
        oss["instagram_user_id"] = env["ig"]      # IG yerleşimleri için kimlik
    creative = g.post(f"{env['acct']}/adcreatives", dict(
        name=f"CR-{slug}{file_suffix}-{lang}",
        object_story_spec=oss,
        asset_feed_spec=_asset_feed_spec(hashes, copy, wa_link)))
    print(f"  ✓ creative {creative['id']} ({len(hashes)} format: {','.join(hashes)})")
    ad = g.post(f"{env['acct']}/ads", dict(
        name=f"AD-{slug}{file_suffix}-{lang}", adset_id=adset["id"],
        creative={"creative_id": creative["id"]}, status="PAUSED"))
    print(f"  ✓ ad {ad['id']}")
    return True


def _concept_tx(out_dir: Path, base_cfg: dict, concept: str, lang: str) -> tuple:
    """Concept'e göre dil-metnini ve dosya son ekini döndürür.
    concept 'b' → kardeş config-b.json (kalite); 'a' → ana config (fiyat). tx'e _lang gömülür (prefill için)."""
    if concept == "b":
        bpath = out_dir / "config-b.json"
        if not bpath.exists():
            return None, "-b"
        tx = json.loads(bpath.read_text(encoding="utf-8")).get("languages", {}).get(lang)
        suffix = "-b"
    else:
        tx = base_cfg.get("languages", {}).get(lang)
        suffix = ""
    if tx is not None:
        tx = dict(tx, _lang=lang)
    return tx, suffix


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("config", type=Path)
    p.add_argument("--daily", type=float, default=50.0,
                   help="ad set başına GÜNLÜK bütçe (hesap para birimi; vars. 50 → ₺50/ad set)")
    p.add_argument("--dry-run", action="store_true", help="çağrı yapma, payload'ları yazdır")
    args = p.parse_args()

    env = _env()
    g = Graph(env, args.dry_run)
    cfg = json.loads(args.config.resolve().read_text(encoding="utf-8"))
    out_dir = args.config.resolve().parent
    slug = cfg.get("slug", out_dir.name)
    tag = cfg.get("tag", f"C1-{slug}")
    daily_minor = int(round(args.daily * 100))

    # Hedefleme config'ten: campaign.adsets = [{lang, countries, concept}]
    adsets = cfg.get("campaign", {}).get("adsets")
    if not adsets:
        sys.exit(f"config'te 'campaign.adsets' yok ({args.config.name}). Hedefleme matrisine göre ekle.")

    print(f"Kampanya kurulumu (PAUSED) · ürün={slug} · {len(adsets)} ad set × {args.daily}/gün "
          f"(hesap para birimi; TRY ise ₺{args.daily:.0f})")
    camp = g.post(f"{env['acct']}/campaigns", dict(
        name=f"C1 · {slug} · CTWA",
        objective="OUTCOME_ENGAGEMENT", status="PAUSED", special_ad_categories=[],
        is_adset_budget_sharing_enabled="false"))
    print(f"  ✓ campaign {camp['id']}")

    for a in adsets:
        lang = a["lang"]; countries = a["countries"]; concept = a.get("concept", "a")
        tx, suffix = _concept_tx(out_dir, cfg, concept, lang)
        if not tx:
            print(f"  · {concept}-{lang}: dil/config bulunamadı, atlandı"); continue
        copy = _creative_text(tx, tag)
        label = f"{concept.upper()}-{lang.upper()}"
        build_unit(g, env, camp["id"], slug, lang, countries, copy, suffix, daily_minor, out_dir, label)

    acct_num = env["acct"].replace("act_", "")
    print("\nHAZIR (hepsi PAUSED). Ads Manager'da incele ve sen yayınla:")
    print(f"  https://adsmanager.facebook.com/adsmanager/manage/campaigns?act={acct_num}")
    print("Yayın = harcama → onay senin. Script reklamı başlatmaz.")


if __name__ == "__main__":
    main()
