#!/usr/bin/env python3
"""
Meta (Facebook/Instagram) Click-to-WhatsApp kampanyasını Marketing API ile **PAUSED**
(duraklatılmış) olarak kurar. Yayını/harcamayı BAŞLATMAZ — Asaf Ads Manager'da "yayınla"ya
basar. "Sen kurgula, ben çalıştırırım" yolu: tek komut → kampanya + 2 ad set (EN/FR) + creative + ad.

Akış (graph.facebook.com):
  1) campaign (OUTCOME_ENGAGEMENT, PAUSED)
  2) her dil için ad set (optimization CONVERSATIONS, destination WHATSAPP, geo=dil bölgesi, PAUSED)
  3) creative görselini /adimages'a yükle → image_hash
  4) ad creative — GERÇEK CTWA: object_story_spec.link_data + call_to_action
     {type: WHATSAPP_MESSAGE, value:{app_destination: WHATSAPP, link: api.whatsapp.com/send?phone&text}}
     (DİKKAT: asset_feed_spec çok-format CTWA'yı BOZAR → Meta is_click_to_message=false yapar,
      tıklama tarayıcı/App Store'a düşer. Bu yüzden tek görsel link_data kullanılır.)
  5) ad (PAUSED)

Video reklam (concept "video", 2026-07-07): adset'in concept'i "video" ise creative
object_story_spec.video_data ile kurulur (link_data değil) — /advideos'a yükle, 'ready' olana kadar
bekle, thumbnail = concept "a"nın feed görseli (ayrıca üretmeye gerek yok). Video dosyası config'in
üst seviye `video_files: {"<lang>": "<dosya-adı.mp4>"}` alanından okunur (creative klasörüne göreli).
Metin concept "a" ile birebir aynı kaynaktan (ana config'in languages bloğu) gelir.

Kimlik bilgileri .env.local'dan (koda yazılmaz):
  META_ACCESS_TOKEN   (ads_management + pages_* + whatsapp_business_management scope'lu uzun-ömürlü token)
  META_AD_ACCOUNT_ID  (act_ önekli ya da sadece sayı)
  META_PAGE_ID        (reklamı yayınlayacak Facebook Sayfası ID'si; WhatsApp numarası buna bağlı olmalı)
  META_API_VERSION    (opsiyonel, vars. v21.0)
  WHATSAPP_NUMBER     (opsiyonel; yoksa marka kaydındaki numaraya düşer — brand.py)

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

# Marka motoru — WhatsApp fallback marka kaydından (env BRAND_ID). BRAND_ID yoksa
# ProcessTürk varsayılanı → canlı davranış + PAUSED güvenliği aynen korunur.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from brand import BRAND as _BR   # noqa: E402
_WA_FALLBACK = _BR["whatsapp"]


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
        wa=os.environ.get("WHATSAPP_NUMBER", _WA_FALLBACK),
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

    def upload_video(self, video: Path, wait: int = 300) -> str:
        """/advideos'a yükle, işlenmesini bekle (status.video_status == 'ready'). Video ID döner."""
        if self.dry:
            print(f"  [dry-run] /advideos upload {video.name} (+ ready bekleme atlandı)")
            return f"DRYVIDEO_{uuid.uuid4().hex[:8]}"
        boundary = "----ptk" + uuid.uuid4().hex
        mime = mimetypes.guess_type(str(video))[0] or "video/mp4"
        body = bytearray()
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="access_token"\r\n\r\n{self.e["token"]}\r\n'.encode()
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="source"; filename="{video.name}"\r\n'.encode()
        body += f"Content-Type: {mime}\r\n\r\n".encode()
        body += video.read_bytes() + b"\r\n"
        body += f"--{boundary}--\r\n".encode()
        req = urllib.request.Request(
            self._url(f"{self.e['acct']}/advideos"), data=bytes(body), method="POST",
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
        try:
            res = json.loads(_urlopen_retry(req, 300).decode())
        except urllib.error.HTTPError as ex:
            sys.exit(f"Video yükleme hata {ex.code}:\n{ex.read().decode('utf-8','ignore')[:800]}")
        vid = res["id"]
        # Meta video-yi arka planda işler (kısa klipte genelde saniyeler-birkaç dk); ready olana kadar bekle.
        deadline = time.time() + wait
        while time.time() < deadline:
            status_req = urllib.request.Request(
                self._url(f"{vid}") + f"?fields=status&access_token={self.e['token']}")
            st = json.loads(_urlopen_retry(status_req, 30).decode())
            phase = st.get("status", {}).get("video_status")
            if phase == "ready":
                return vid
            if phase == "error":
                sys.exit(f"Video işleme hatası ({vid}): {json.dumps(st)[:500]}")
            time.sleep(5)
        sys.exit(f"Video {wait}sn içinde 'ready' olmadı ({vid}) — Ads Manager'dan elle kontrol et.")


def _link_data(feed_hash: str, copy: dict, wa_link: str) -> dict:
    """GERÇEK Click-to-WhatsApp creative gövdesi (object_story_spec.link_data).
    KRİTİK: call_to_action.value.app_destination = WHATSAPP olmadan Meta reklamı website-link
    sayar (is_click_to_message=false) → tıklama tarayıcı/App Store'a düşer, WhatsApp açılmaz.
    Tek görsel (feed/4:5) kullanılır; asset_feed_spec çok-format CTWA'yı bozduğu için kullanılamaz.
    Prefill metni (link'teki text=) [REKLAM:]/[ref:] etiketini taşır → chatbot atıfı korunur."""
    return {
        "image_hash": feed_hash,
        "message": copy["primary"],
        "name": copy["headline"],
        "description": copy["description"],
        "link": wa_link,
        "call_to_action": {"type": "WHATSAPP_MESSAGE",
                           "value": {"app_destination": "WHATSAPP", "link": wa_link}},
    }


def _video_data(video_id: str, thumb_hash: str, copy: dict, wa_link: str) -> dict:
    """Video CTWA creative gövdesi (object_story_spec.video_data). link_data'nın video muadili —
    aynı WHATSAPP_MESSAGE call_to_action'ı kullanır, image_hash yerine video_id + thumbnail (image_hash) alır."""
    return {
        "video_id": video_id,
        "image_hash": thumb_hash,
        "title": copy["headline"],
        "message": copy["primary"],
        "link_description": copy["description"],
        "call_to_action": {"type": "WHATSAPP_MESSAGE",
                           "value": {"app_destination": "WHATSAPP", "link": wa_link}},
    }


def build_unit_video(g: "Graph", env: dict, camp_id: str, slug: str, lang: str, geo: list,
                      copy: dict, video_path: Path, thumb_path: Path, daily_minor: int, label: str) -> bool:
    """build_unit'in video muadili: tek ad set + video creative + ad (PAUSED). Thumbnail = eşleşen
    statik creative'in feed görseli (ayrıca üretmeye gerek yok)."""
    if not copy:
        print(f"  · {label}: COPY tanımsız, atlandı"); return False
    if not video_path.exists():
        print(f"  · {label}: video yok ({video_path.name}), atlandı"); return False
    if not thumb_path.exists():
        print(f"  · {label}: thumbnail yok ({thumb_path.name}), atlandı"); return False

    adset = g.post(f"{env['acct']}/adsets", dict(
        name=f"AS-{label} · {'/'.join(geo)}",
        campaign_id=camp_id, status="PAUSED",
        billing_event="IMPRESSIONS", optimization_goal="CONVERSATIONS",
        bid_strategy="LOWEST_COST_WITHOUT_CAP",
        destination_type="WHATSAPP", daily_budget=daily_minor,
        promoted_object={"page_id": env["page"]},
        targeting={"geo_locations": {"countries": geo}, "age_min": 25, "age_max": 55,
                   "publisher_platforms": ["facebook", "instagram"],
                   "facebook_positions": ["feed", "story", "facebook_reels"],
                   "instagram_positions": ["stream", "story", "reels", "explore"],
                   "targeting_automation": {"advantage_audience": 0}}))
    print(f"  ✓ adset {adset['id']} ({label} → {','.join(geo)})")

    video_id = g.upload_video(video_path)
    thumb_hash = g.upload_image(thumb_path)
    ref = f"{slug}-{label.lower()}"
    wa_link = "https://api.whatsapp.com/send?phone=" + env["wa"] + "&text=" + urllib.parse.quote(
        copy["prefill"] + f" [ref: {ref}]")
    oss = {"page_id": env["page"]}
    if env.get("ig"):
        oss["instagram_user_id"] = env["ig"]
    oss["video_data"] = _video_data(video_id, thumb_hash, copy, wa_link)
    creative = g.post(f"{env['acct']}/adcreatives", dict(
        name=f"CR-{slug}-video-{lang}",
        object_story_spec=oss))
    print(f"  ✓ creative {creative['id']} (CTWA video_data, app_destination=WHATSAPP)")
    ad = g.post(f"{env['acct']}/ads", dict(
        name=f"AD-{slug}-video-{lang}", adset_id=adset["id"],
        creative={"creative_id": creative["id"]}, status="PAUSED"))
    print(f"  ✓ ad {ad['id']}")
    return True


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
                   # Açık yerleşimler: yalnız asset_customization_rules'ın kapsadığı formatlar
                   # (profil akışı / bildirim / keşfet-grid gibi kapsanmayan yeni formatlar dışarıda → "0 kural" uyarısı olmaz)
                   "facebook_positions": ["feed", "story", "facebook_reels"],
                   "instagram_positions": ["stream", "story", "reels", "explore"],
                   "targeting_automation": {"advantage_audience": 0}}))   # sabit kitle (A/B kontrollü)
    print(f"  ✓ adset {adset['id']} ({label} → {','.join(geo)})")

    feed_hash = g.upload_image(imgs["feed"])    # CTWA tek görsel (feed/4:5) — link_data tek hash alır
    # Zengin atıf: rota etiketi [REKLAM: ...] AYNI kalır (chatbot okur) + ref kodu (CRM atıf)
    ref = f"{slug}-{label.lower()}"            # ör. granul-dolum-a-en
    # api.whatsapp.com/send + app_destination=WHATSAPP → gerçek CTWA (wa.me website-link olarak yorumlanabiliyor)
    wa_link = "https://api.whatsapp.com/send?phone=" + env["wa"] + "&text=" + urllib.parse.quote(
        copy["prefill"] + f" [ref: {ref}]")
    oss = {"page_id": env["page"]}
    if env.get("ig"):
        oss["instagram_user_id"] = env["ig"]      # IG yerleşimleri için kimlik
    oss["link_data"] = _link_data(feed_hash, copy, wa_link)
    creative = g.post(f"{env['acct']}/adcreatives", dict(
        name=f"CR-{slug}{file_suffix}-{lang}",
        object_story_spec=oss))
    print(f"  ✓ creative {creative['id']} (CTWA link_data, app_destination=WHATSAPP)")
    ad = g.post(f"{env['acct']}/ads", dict(
        name=f"AD-{slug}{file_suffix}-{lang}", adset_id=adset["id"],
        creative={"creative_id": creative["id"]}, status="PAUSED"))
    print(f"  ✓ ad {ad['id']}")
    return True


def _concept_tx(out_dir: Path, base_cfg: dict, concept: str, lang: str) -> tuple:
    """Concept'e göre dil-metnini ve creative dosya son ekini döndürür. tx'e _lang gömülür (prefill için).
    Metin kaynağı: 'b'/'b-hf' → kardeş config-b.json (kalite/menşei); 'a'/'a-hf' → ana config (fiyat).
    Dosya seti:  a→''  ·  b→'-b' (cutout)  ·  a-hf→'-hf'  ·  b-hf→'-b-hf'  (Higgsfield lifestyle sahne)
    ·  a-framed→'-framed'  ·  b-framed→'-b-framed'  (STANDART çerçeveli kart — make_framed.py)."""
    SUFFIX = {"a": "", "b": "-b", "a-hf": "-hf", "b-hf": "-b-hf",
              "a-framed": "-framed", "b-framed": "-b-framed", "framed": "-framed",
              "video": ""}   # video ads: metin concept "a" ile aynı, thumbnail da "a"nın feed görseli
    suffix = SUFFIX.get(concept, "")
    if concept in ("b", "b-hf", "b-framed"):
        bpath = out_dir / "config-b.json"
        if not bpath.exists():
            return None, suffix
        tx = json.loads(bpath.read_text(encoding="utf-8")).get("languages", {}).get(lang)
    else:
        tx = base_cfg.get("languages", {}).get(lang)
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

    video_files = cfg.get("video_files", {})   # {"en": "video-konveyor-en.mp4", ...} — concept "video" için
    for a in adsets:
        lang = a["lang"]; countries = a["countries"]; concept = a.get("concept", "a")
        tx, suffix = _concept_tx(out_dir, cfg, concept, lang)
        if not tx:
            print(f"  · {concept}-{lang}: dil/config bulunamadı, atlandı"); continue
        copy = _creative_text(tx, tag)
        label = f"{concept.upper()}-{lang.upper()}"
        if concept == "video":
            vf = video_files.get(lang)
            if not vf:
                print(f"  · {label}: video_files['{lang}'] tanımsız, atlandı"); continue
            video_path = out_dir / vf
            thumb_path = out_dir / f"{slug}{suffix}-{lang}-feed.png"
            build_unit_video(g, env, camp["id"], slug, lang, countries, copy,
                              video_path, thumb_path, daily_minor, label)
        else:
            build_unit(g, env, camp["id"], slug, lang, countries, copy, suffix, daily_minor, out_dir, label)

    acct_num = env["acct"].replace("act_", "")
    print("\nHAZIR (hepsi PAUSED). Ads Manager'da incele ve sen yayınla:")
    print(f"  https://adsmanager.facebook.com/adsmanager/manage/campaigns?act={acct_num}")
    print("Yayın = harcama → onay senin. Script reklamı başlatmaz.")


if __name__ == "__main__":
    main()
