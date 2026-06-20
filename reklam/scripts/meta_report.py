#!/usr/bin/env python3
"""
Meta reklam RAPORLAMA — uzun vadeli veri akışı.
Meta Insights API'den (READ-ONLY) günlük metrikleri çeker, data/meta_insights.csv zaman serisine
EKLER (gün+ad bazında idempotent), ve konsept (A/B) başına CPL özetini yazdırır.

Metrikler: spend, impressions, reach, clicks, cpm, WhatsApp sohbet başlama (messaging_conversation_started),
sohbet başına maliyet (CPL). Tüm kampanyalar için çalışır (hesap geneli).

Kullanım:
  python3 meta_report.py                    # son 7 gün (varsayılan)
  python3 meta_report.py --since 2026-06-01 --until 2026-06-30
  python3 meta_report.py --preset maximum    # tüm zaman

.env.local: META_ACCESS_TOKEN, META_AD_ACCOUNT_ID gerekli.
"""
import argparse
import csv
import json
import os
import sys
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent   # reklam/
APP_ROOT = ROOT.parent                           # Processturk_Pazarlama_Merkezi/ (tek data/ + .env.local)
CSV_PATH = APP_ROOT / "data" / "meta_insights.csv"
COLS = ["date", "campaign", "adset", "ad", "spend", "impressions", "reach", "clicks",
        "cpm", "conversations", "cpl"]
CONV_KEYS = ("messaging_conversation_started", "messaging_first_reply",
             "onsite_conversion.total_messaging_connection")


def _env() -> dict:
    f = next((p for p in (APP_ROOT / ".env.local", ROOT / ".env.local") if p.exists()), None)
    if f is not None:
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    tok = os.environ.get("META_ACCESS_TOKEN"); acct = os.environ.get("META_AD_ACCOUNT_ID")
    if not tok or not acct:
        sys.exit("Eksik .env.local: META_ACCESS_TOKEN, META_AD_ACCOUNT_ID gerekli.")
    if not acct.startswith("act_"):
        acct = "act_" + acct
    return dict(token=tok, acct=acct, ver=os.environ.get("META_API_VERSION", "v21.0"))


def _get(env: dict, path: str, params: dict) -> dict:
    params["access_token"] = env["token"]
    url = f"https://graph.facebook.com/{env['ver']}/{path}?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=120) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"Insights hata {e.code}: {e.read().decode('utf-8','ignore')[:400]}")


def _conversations(actions) -> int:
    if not actions:
        return 0
    total = 0
    for a in actions:
        if any(k in a.get("action_type", "") for k in CONV_KEYS):
            try:
                total += int(float(a.get("value", 0)))
            except (TypeError, ValueError):
                pass
    return total


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--since"); p.add_argument("--until")
    p.add_argument("--preset", default="last_7d",
                   help="date_preset (last_7d, last_30d, maximum…). --since/--until verilirse yok sayılır.")
    p.add_argument("--emit-json", action="store_true",
                   help="İnsan çıktısı yerine panel için tek satır JSON (rows + concept özeti) bas.")
    args = p.parse_args()
    JSON = args.emit_json

    def log(*a):
        if not JSON:
            print(*a)
    env = _env()

    params = {"level": "ad", "time_increment": "1", "limit": "500",
              "fields": "campaign_name,adset_name,ad_name,spend,impressions,reach,clicks,cpm,actions"}
    if args.since and args.until:
        params["time_range"] = json.dumps({"since": args.since, "until": args.until})
    else:
        params["date_preset"] = args.preset

    rows = []
    data = _get(env, f"{env['acct']}/insights", params)
    while True:
        for r in data.get("data", []):
            conv = _conversations(r.get("actions"))
            spend = float(r.get("spend", 0) or 0)
            rows.append({
                "date": r.get("date_start", ""),
                "campaign": r.get("campaign_name", ""), "adset": r.get("adset_name", ""),
                "ad": r.get("ad_name", ""), "spend": f"{spend:.2f}",
                "impressions": r.get("impressions", "0"), "reach": r.get("reach", "0"),
                "clicks": r.get("clicks", "0"), "cpm": r.get("cpm", "0"),
                "conversations": str(conv),
                "cpl": f"{spend/conv:.2f}" if conv else "",
            })
        nxt = data.get("paging", {}).get("next")
        if not nxt:
            break
        with urllib.request.urlopen(nxt, timeout=120) as rr:
            data = json.loads(rr.read().decode())

    if not rows:
        log("Insights boş — kampanya henüz yayında değil / veri yok (PAUSED'da normal). "
            "Yapı doğru; yayına alınınca veri akacak.")
    # CSV'ye idempotent ekle (date+ad anahtarı)
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    existing = {}
    if CSV_PATH.exists():
        with CSV_PATH.open(encoding="utf-8") as f:
            for row in csv.DictReader(f):
                existing[(row["date"], row["ad"])] = row
    for r in rows:
        existing[(r["date"], r["ad"])] = r
    with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS); w.writeheader()
        for r in sorted(existing.values(), key=lambda x: (x["date"], x["ad"])):
            w.writerow(r)
    log(f"CSV güncellendi: {CSV_PATH} ({len(existing)} satır)")

    # Konsept (ad) bazında özet
    agg = {}
    for r in rows:
        k = r["ad"]
        a = agg.setdefault(k, {"spend": 0.0, "imp": 0, "conv": 0})
        a["spend"] += float(r["spend"]); a["imp"] += int(r["impressions"] or 0)
        a["conv"] += int(r["conversations"] or 0)
    if JSON:
        summary = [
            {"ad": k, "spend": round(a["spend"], 2), "impressions": a["imp"],
             "conversations": a["conv"], "cpl": round(a["spend"] / a["conv"], 2) if a["conv"] else None}
            for k, a in sorted(agg.items())
        ]
        print(json.dumps({"ok": True, "rows": rows, "summary": summary,
                          "total_rows": len(existing)}, ensure_ascii=False))
        return
    if rows:
        print("\n=== Reklam (konsept) özeti ===")
        print(f"{'reklam':28} {'harcama':>10} {'gösterim':>10} {'sohbet':>7} {'CPL':>9}")
        for k, a in sorted(agg.items()):
            cpl = f"{a['spend']/a['conv']:.2f}" if a["conv"] else "—"
            print(f"{k:28} {a['spend']:>10.2f} {a['imp']:>10} {a['conv']:>7} {cpl:>9}")
        print("\nA vs B: en düşük CPL'li konsept kazanır → diğer dillere (FR) taşı.")


if __name__ == "__main__":
    main()
