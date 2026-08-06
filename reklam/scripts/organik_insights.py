#!/usr/bin/env python3
"""ORGANİK gönderi performansını okur (Instagram + Facebook), READ-ONLY.

meta_report.py REKLAM insights'ı okur; bu onun organik ikizidir. Amaç: hangi içerik/dil/
kanal/saat gerçekten etkileşim alıyor → sosyal metin kurallarını VERİYLE beslemek
(sosyal-icerik-optimize yeteneği). Hiçbir şey yayınlamaz, hiçbir şeyi değiştirmez.

  python3 organik_insights.py                 # son 30 gün, tüm gönderiler
  python3 organik_insights.py --gun 7 --json

Çıktı: data/organik_insights.csv (append, mükerrersiz) + isteğe bağlı JSON özet.
Anahtar: .env.local → META_ACCESS_TOKEN + IG_USER_ID / META_PAGE_ID.
"""
import argparse, csv, json, os, sys, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = APP_ROOT / "data" / "organik_insights.csv"
# ⚠️ IG'de beğeni/yorum INSIGHTS'ta DEĞİL, medya ALANIDIR (like_count/comments_count).
# insights'a likes/saves/shares istenirse tüm çağrı 400 döner ve METRİK HİÇ GELMEZ
# (2026-07-24'te bu yaşandı: CSV'de yalnız metin sütunları vardı, sayı yoktu).
IG_ALANLAR = "id,caption,media_type,permalink,timestamp,like_count,comments_count"
IG_METRIKLER = "reach,views"
FB_METRIKLER = "post_impressions_unique,post_engaged_users,post_video_views"


def _env() -> dict:
    for p in (APP_ROOT / ".env.local", APP_ROOT.parent / ".env.local"):
        if p.exists():
            for line in p.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    tok = os.environ.get("META_ACCESS_TOKEN")
    if not tok:
        sys.exit("Eksik .env.local: META_ACCESS_TOKEN")
    return dict(token=tok, ig=os.environ.get("META_IG_BUSINESS_ID") or os.environ.get("IG_USER_ID"),
                page=os.environ.get("META_PAGE_ID"), ver=os.environ.get("META_API_VERSION", "v21.0"))


def _get(env: dict, path: str, params: dict) -> dict:
    params["access_token"] = env["token"]
    url = f"https://graph.facebook.com/{env['ver']}/{path}?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=90) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        # Tek gönderi hatası TÜM raporu düşürmesin (silinmiş/uygun olmayan medya olur).
        return {"_hata": f"{e.code}: {e.read().decode('utf-8','ignore')[:180]}"}


def _ig(env, since):
    if not env["ig"]:
        return []
    d = _get(env, f"{env['ig']}/media", {"fields": IG_ALANLAR, "limit": 100})
    out = []
    for m in d.get("data", []):
        if m.get("timestamp", "") < since:
            continue
        ins = _get(env, f"{m['id']}/insights", {"metric": IG_METRIKLER})
        vals = {x["name"]: (x.get("values") or [{}])[0].get("value", 0) for x in ins.get("data", [])}
        out.append(dict(kanal="instagram", id=m["id"], zaman=m.get("timestamp", ""),
                        tur=m.get("media_type", ""), link=m.get("permalink", ""),
                        likes=m.get("like_count", 0), comments=m.get("comments_count", 0),
                        metin=(m.get("caption") or "")[:400].replace("\n", " "), **vals))
    return out


def _fb(env, since):
    if not env["page"]:
        return []
    d = _get(env, f"{env['page']}/posts", {"fields": "id,message,permalink_url,created_time", "limit": 100})
    out = []
    for m in d.get("data", []):
        if m.get("created_time", "") < since:
            continue
        ins = _get(env, f"{m['id']}/insights", {"metric": FB_METRIKLER})
        vals = {x["name"]: (x.get("values") or [{}])[0].get("value", 0) for x in ins.get("data", [])}
        out.append(dict(kanal="facebook", id=m["id"], zaman=m.get("created_time", ""), tur="post",
                        link=m.get("permalink_url", ""),
                        metin=(m.get("message") or "")[:400].replace("\n", " "), **vals))
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--gun", type=int, default=30)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    env = _env()
    since = (datetime.now(timezone.utc) - timedelta(days=a.gun)).isoformat()
    kayitlar = _ig(env, since) + _fb(env, since)
    if not kayitlar:
        print("Kayıt yok (IG_USER_ID/META_PAGE_ID tanımlı mı?)", file=sys.stderr)

    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    var = set()
    if CSV_PATH.exists():
        with CSV_PATH.open(encoding="utf-8") as f:
            var = {r.get("id", "") for r in csv.DictReader(f)}
    alanlar = sorted({k for r in kayitlar for k in r})
    yeni = [r for r in kayitlar if r["id"] not in var]
    if yeni:
        yaz_basligi = not CSV_PATH.exists()
        with CSV_PATH.open("a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=alanlar, extrasaction="ignore")
            if yaz_basligi:
                w.writeheader()
            w.writerows(yeni)
    print(f"{len(kayitlar)} gönderi okundu · {len(yeni)} yeni satır → {CSV_PATH}", file=sys.stderr)
    if a.json:
        print(json.dumps(kayitlar, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
