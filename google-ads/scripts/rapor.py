#!/usr/bin/env python3
"""
Performans raporu — kampanya + reklam grupları + en çok harcayan aramalar.
Kullanım: python3 scripts/rapor.py [gün]   (varsayılan 7)
Çıktıyı ekrana basar ve outputs/rapor-<tarih>.txt'ye kaydeder. Salt-okunur.
"""
import sys, os, datetime
from _client import build_client, ACCOUNT_ID

CID = "23998449813"
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "outputs"))


def L(m): return m / 1_000_000


def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 7
    end = datetime.date.today()
    start = end - datetime.timedelta(days=days)
    seg = f"segments.date BETWEEN '{start}' AND '{end}'"
    client = build_client(); ga = client.get_service("GoogleAdsService")

    lines = []
    def out(s=""): lines.append(s); print(s)

    out(f"===== PT-Search-EN-Turnkey · SON {days} GÜN ({start} → {end}) =====")

    imp = clk = cost = conv = 0.0
    for r in ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions "
        f"FROM campaign WHERE campaign.id={CID} AND {seg}")):
        imp += r.metrics.impressions; clk += r.metrics.clicks
        cost += r.metrics.cost_micros; conv += r.metrics.conversions
    ctr = (clk / imp * 100) if imp else 0
    cpc = (L(cost) / clk) if clk else 0
    cpl = (L(cost) / conv) if conv else 0
    out(f"Gösterim {int(imp)} · Tıklama {int(clk)} · CTR %{ctr:.1f} · Ort. TBM ₺{cpc:.2f}")
    out(f"Maliyet ₺{L(cost):.2f} · Dönüşüm {conv:.1f} · CPL {('₺%.2f' % cpl) if conv else '— (henüz dönüşüm yok)'}")

    out("\n-- Reklam grupları (maliyet sırası) --")
    rows = list(ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT ad_group.name, metrics.clicks, metrics.cost_micros, metrics.conversions "
        f"FROM ad_group WHERE campaign.id={CID} AND {seg} ORDER BY metrics.cost_micros DESC")))
    if not rows:
        out("  (bu aralıkta veri yok)")
    for r in rows:
        c = r.metrics.conversions
        out(f"  {r.ad_group.name}: tık {int(r.metrics.clicks)} · ₺{L(r.metrics.cost_micros):.2f} · "
            f"dön {c:.1f}" + (f" · CPL ₺{L(r.metrics.cost_micros)/c:.2f}" if c else ""))

    out("\n-- En çok harcayan aramalar (ilk 20) --")
    strows = list(ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT search_term_view.search_term, metrics.clicks, metrics.cost_micros, "
        f"metrics.conversions FROM search_term_view WHERE campaign.id={CID} AND {seg} "
        f"ORDER BY metrics.cost_micros DESC LIMIT 20")))
    if not strows:
        out("  (henüz arama verisi yok)")
    for r in strows:
        out(f"  \"{r.search_term_view.search_term}\": tık {int(r.metrics.clicks)} · "
            f"₺{L(r.metrics.cost_micros):.2f} · dön {r.metrics.conversions:.1f}")

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"rapor-{end}.txt")
    with open(path, "w") as f:
        f.write("\n".join(lines))
    print(f"\n💾 Kaydedildi: outputs/rapor-{end}.txt")


if __name__ == "__main__":
    main()
