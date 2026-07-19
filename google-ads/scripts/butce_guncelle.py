#!/usr/bin/env python3
"""
Kampanya günlük bütçesini güncelle.
Kullanım:
  python3 scripts/butce_guncelle.py <campaign_id> <yeni_butce_TL> [--apply]
  python3 scripts/butce_guncelle.py 23998449813 200            # önizleme (dry-run)
  python3 scripts/butce_guncelle.py 23998449813 200 --apply    # uygula

Varsayılan: yalnız ÖNİZLER (dry). --apply verilmeden hiçbir şey değişmez.
Yalnız günlük bütçeyi değiştirir, CPC teklifine dokunmaz (bkz. teklif_guncelle.py).
"""
import sys
from _client import build_client, ACCOUNT_ID


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 2:
        sys.exit("Kullanım: butce_guncelle.py <campaign_id> <yeni_butce_TL> [--apply]")
    cid, yeni_tl = args[0], float(args[1])
    apply = "--apply" in sys.argv
    yeni_micros = int(yeni_tl * 1_000_000)

    client = build_client()
    ga = client.get_service("GoogleAdsService")

    rows = list(ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT campaign.name, campaign_budget.resource_name, campaign_budget.amount_micros "
        f"FROM campaign WHERE campaign.id = {cid}")))

    if not rows:
        sys.exit(f"Kampanya {cid} bulunamadı.")

    r = rows[0]
    eski = r.campaign_budget.amount_micros / 1_000_000
    print(f"===== Günlük bütçe güncelleme · {r.campaign.name} (id {cid}) =====")
    print(f"  ₺{eski:.2f}/gün → ₺{yeni_tl:.2f}/gün")

    if not apply:
        print("\n(Önizleme modu — hiçbir şey değişmedi. Uygulamak için: --apply)")
        return

    op = client.get_type("CampaignBudgetOperation")
    op.update.resource_name = r.campaign_budget.resource_name
    op.update.amount_micros = yeni_micros
    op.update_mask.paths.append("amount_micros")

    client.get_service("CampaignBudgetService").mutate_campaign_budgets(
        customer_id=ACCOUNT_ID, operations=[op])
    print(f"\n✓ Günlük bütçe ₺{yeni_tl:.2f} olarak güncellendi.")


if __name__ == "__main__":
    main()
