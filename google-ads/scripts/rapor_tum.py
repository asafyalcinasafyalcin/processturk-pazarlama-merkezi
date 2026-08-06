"""
Tüm kampanyalar için canlı rapor — 30g + 7g metrikleri, kampanya durumu, bütçe.
Salt-okunur. Kullanım: python3 scripts/rapor_tum.py
"""
import sys
from _client import build_client, ACCOUNT_ID


def q(client, ga, query):
    return ga.search(customer_id=ACCOUNT_ID, query=query)


def fmt_money(micros):
    return micros / 1_000_000


def main():
    client = build_client()
    ga = client.get_service("GoogleAdsService")

    # Kampanya listesi + durum + bütçe
    kampanyalar = {}
    for row in q(client, ga, """
        SELECT campaign.id, campaign.name, campaign.status,
               campaign.advertising_channel_type,
               campaign_budget.amount_micros
        FROM campaign
        ORDER BY campaign.id
    """):
        kampanyalar[row.campaign.id] = {
            "name": row.campaign.name,
            "status": row.campaign.status.name,
            "type": row.campaign.advertising_channel_type.name,
            "budget": fmt_money(row.campaign_budget.amount_micros),
            "d30": None, "d7": None,
        }

    def metrics(period):
        out = {}
        for row in q(client, ga, f"""
            SELECT campaign.id,
                   metrics.impressions, metrics.clicks, metrics.cost_micros,
                   metrics.conversions, metrics.ctr, metrics.average_cpc
            FROM campaign
            WHERE segments.date DURING {period}
        """):
            out[row.campaign.id] = {
                "impr": row.metrics.impressions,
                "clicks": row.metrics.clicks,
                "cost": fmt_money(row.metrics.cost_micros),
                "conv": row.metrics.conversions,
                "ctr": row.metrics.ctr * 100,
                "cpc": fmt_money(row.metrics.average_cpc),
            }
        return out

    d30 = metrics("LAST_30_DAYS")
    d7 = metrics("LAST_7_DAYS")

    print("=" * 78)
    print(f"GOOGLE ADS RAPORU — Hesap {ACCOUNT_ID}")
    print("=" * 78)
    for cid, k in kampanyalar.items():
        m30 = d30.get(cid, {})
        m7 = d7.get(cid, {})
        print(f"\n[{cid}] {k['name']}")
        print(f"   Durum: {k['status']} | Tip: {k['type']} | Bütçe: ₺{k['budget']:.0f}/gün")
        if m30:
            print(f"   30g: {m30['impr']} gösterim | {m30['clicks']} tık | ₺{m30['cost']:.2f} | "
                  f"{m30['conv']:.1f} dönüşüm | CTR %{m30['ctr']:.1f} | CPC ₺{m30['cpc']:.2f}")
        else:
            print(f"   30g: veri yok (0 gösterim)")
        if m7:
            print(f"    7g: {m7['impr']} gösterim | {m7['clicks']} tık | ₺{m7['cost']:.2f} | "
                  f"{m7['conv']:.1f} dönüşüm")
        else:
            print(f"    7g: veri yok (0 gösterim)")
    print("\n" + "=" * 78)


if __name__ == "__main__":
    main()
