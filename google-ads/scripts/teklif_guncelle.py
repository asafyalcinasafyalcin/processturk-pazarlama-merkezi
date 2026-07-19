#!/usr/bin/env python3
"""
Reklam grubu maksimum CPC teklifini güncelle (Manual CPC kampanyalarda).
Kullanım:
  python3 scripts/teklif_guncelle.py <campaign_id> <yeni_cpc_TL> [--apply]
  python3 scripts/teklif_guncelle.py 23998449813 18            # önizleme (dry-run)
  python3 scripts/teklif_guncelle.py 23998449813 18 --apply    # uygula

Varsayılan: yalnız ÖNİZLER (dry). --apply verilmeden hiçbir şey değişmez.
Bütçe (günlük harcama tavanı) BU SCRİPT'LE değişmez, yalnız tıklama başı teklif.
"""
import sys
from _client import build_client, ACCOUNT_ID


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 2:
        sys.exit("Kullanım: teklif_guncelle.py <campaign_id> <yeni_cpc_TL> [--apply]")
    cid, yeni_tl = args[0], float(args[1])
    apply = "--apply" in sys.argv
    yeni_micros = int(yeni_tl * 1_000_000)

    client = build_client()
    ga = client.get_service("GoogleAdsService")

    rows = list(ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT ad_group.id, ad_group.name, ad_group.resource_name, ad_group.cpc_bid_micros "
        f"FROM ad_group WHERE campaign.id = {cid} AND ad_group.status != 'REMOVED'")))

    if not rows:
        sys.exit(f"Kampanya {cid} altında reklam grubu bulunamadı.")

    print(f"===== CPC teklif güncelleme · kampanya {cid} =====")
    for r in rows:
        eski = r.ad_group.cpc_bid_micros / 1_000_000
        print(f"  {r.ad_group.name:28s} ₺{eski:.2f} → ₺{yeni_tl:.2f}")

    if not apply:
        print("\n(Önizleme modu — hiçbir şey değişmedi. Uygulamak için: --apply)")
        return

    ops = []
    for r in rows:
        op = client.get_type("AdGroupOperation")
        op.update.resource_name = r.ad_group.resource_name
        op.update.cpc_bid_micros = yeni_micros
        op.update_mask.paths.append("cpc_bid_micros")
        ops.append(op)

    client.get_service("AdGroupService").mutate_ad_groups(customer_id=ACCOUNT_ID, operations=ops)
    print(f"\n✓ {len(ops)} reklam grubu → ₺{yeni_tl:.2f} maksimum CPC olarak güncellendi.")


if __name__ == "__main__":
    main()
