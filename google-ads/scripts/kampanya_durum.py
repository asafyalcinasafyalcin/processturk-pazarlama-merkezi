#!/usr/bin/env python3
"""
Kampanya durumu değiştir — yayına al / duraklat.
Kullanım: python3 scripts/kampanya_durum.py <campaign_id> <ENABLED|PAUSED> [--force]

ZORUNLU KAPI: ENABLED yapmadan önce TÜM Final URL'ler AdsBot gözünden 200 doğrulanır
(url_kontrol.py). Geçmezse yayına ALINMAZ. Bilerek geçmek için: --force
"""
import sys
from _client import build_client, ACCOUNT_ID
from url_kontrol import verify


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 2:
        sys.exit("Kullanım: kampanya_durum.py <campaign_id> <ENABLED|PAUSED> [--force]")
    cid, status = args[0], args[1].upper()

    # Yayın kapısı: URL doğrulaması geçmeden ENABLED yok
    if status == "ENABLED" and "--force" not in sys.argv:
        print("— Yayın öncesi zorunlu URL kontrolü —")
        if not verify(cid):
            sys.exit("\n⛔ YAYINA ALINMADI: yukarıdaki URL('ler) AdsBot'a 200 dönmüyor. "
                     "Önce düzelt. (Bilerek geçmek için --force)")
        print("")

    client = build_client()
    svc = client.get_service("CampaignService")
    op = client.get_type("CampaignOperation")
    op.update.resource_name = f"customers/{ACCOUNT_ID}/campaigns/{cid}"
    op.update.status = getattr(client.enums.CampaignStatusEnum, status)
    op.update_mask.paths.append("status")
    svc.mutate_campaigns(customer_id=ACCOUNT_ID, operations=[op])
    print(f"✓ Kampanya {cid} → {status}")


if __name__ == "__main__":
    main()
