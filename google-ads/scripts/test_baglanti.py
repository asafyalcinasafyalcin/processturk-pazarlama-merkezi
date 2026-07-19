#!/usr/bin/env python3
"""
Google Ads API bağlantı testi — hesaba erişebiliyor muyuz + kampanyaları okuyabiliyor muyuz?
Çalıştır: python3 scripts/test_baglanti.py
"""
import sys
from _client import build_client, ACCOUNT_ID


def main():
    try:
        client = build_client()
    except ImportError:
        sys.exit("Eksik paket. Çalıştır:  pip3 install google-ads")

    ga = client.get_service("GoogleAdsService")

    print("== HESAP ==")
    for row in ga.search(customer_id=ACCOUNT_ID, query=(
        "SELECT customer.descriptive_name, customer.currency_code, customer.time_zone "
        "FROM customer LIMIT 1")):
        print(f"  {row.customer.descriptive_name} · {row.customer.currency_code} · {row.customer.time_zone}")

    print("\n== KAMPANYALAR ==")
    n = 0
    for row in ga.search(customer_id=ACCOUNT_ID, query=(
        "SELECT campaign.name, campaign.advertising_channel_type, campaign.status FROM campaign")):
        n += 1
        print(f"  • [{row.campaign.advertising_channel_type.name}] {row.campaign.name} — {row.campaign.status.name}")
    print(f"  Toplam: {n}")

    print("\n✅ API BAĞLANTISI ÇALIŞIYOR — Claude hesabı okuyabiliyor.")


if __name__ == "__main__":
    main()
