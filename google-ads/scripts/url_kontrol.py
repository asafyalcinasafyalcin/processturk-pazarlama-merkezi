#!/usr/bin/env python3
"""
URL doğrulama — bir kampanyadaki TÜM Final URL'lerin gerçekten 200 döndürdüğünü,
hem normal tarayıcı hem de AdsBot-Google gözünden kontrol eder.

NEDEN: Google reklamı, hedef URL AdsBot için 200 dönmezse (404/403/engel) REDDEDER.
Bir sayfa tarayıcıda açılıp AdsBot'a kapalı olabilir → bu araç ikisini de dener.

YAYINDAN ÖNCE ZORUNLU. `kampanya_durum.py ... ENABLED` bunu otomatik çağırır ve
başarısızsa yayına ALMAZ.

Kullanım:
  python3 scripts/url_kontrol.py [campaign_id]     # kampanyanın tüm URL'lerini dener
"""
import sys
import urllib.request
import urllib.error
from _client import build_client, ACCOUNT_ID

DEFAULT_CID = "23998449813"

UAS = [
    ("AdsBot", "AdsBot-Google (+http://www.google.com/adsbot.html)"),
    ("Tarayıcı", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                 "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"),
]


def check_url(url):
    """(ok, [(ua_etiket, durum)...]) — tüm UA'larda 200 ise ok=True."""
    results = []
    for label, ua in UAS:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": ua})
            with urllib.request.urlopen(req, timeout=20) as r:
                results.append((label, r.status))
        except urllib.error.HTTPError as e:
            results.append((label, e.code))
        except Exception as e:
            results.append((label, type(e).__name__))
    ok = all(s == 200 for _, s in results)
    return ok, results


def check_urls(urls):
    """Verilen URL listesini doğrular. (hepsi_ok, {url: (ok, results)})"""
    report = {}
    all_ok = True
    for u in dict.fromkeys(urls):  # sırayı koruyarak tekilleştir
        ok, res = check_url(u)
        report[u] = (ok, res)
        if not ok:
            all_ok = False
    return all_ok, report


def campaign_final_urls(campaign_id):
    client = build_client()
    ga = client.get_service("GoogleAdsService")
    urls = {}
    for r in ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT ad_group.name, ad_group_ad.ad.final_urls FROM ad_group_ad "
        f"WHERE campaign.id={campaign_id}")):
        for u in r.ad_group_ad.ad.final_urls:
            urls.setdefault(u, set()).add(r.ad_group.name)
    return urls


def verify(campaign_id):
    """Kampanyadaki tüm Final URL'leri doğrular; hepsi 200 ise True."""
    urls = campaign_final_urls(campaign_id)
    print(f"URL doğrulama — kampanya {campaign_id} ({len(urls)} benzersiz Final URL)")
    all_ok = True
    for u, groups in urls.items():
        ok, res = check_url(u)
        status = " · ".join(f"{lbl}:{st}" for lbl, st in res)
        print(f"  {'✅' if ok else '❌'} {u}  [{status}]  ({', '.join(sorted(groups))})")
        if not ok:
            all_ok = False
    return all_ok


def main():
    cid = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CID
    if verify(cid):
        print("\n✅ Tüm URL'ler 200 — yayına uygun.")
        sys.exit(0)
    print("\n❌ En az bir URL bozuk (AdsBot 200 almıyor) — DÜZELTMEDEN YAYINA ALMA.")
    sys.exit(1)


if __name__ == "__main__":
    main()
