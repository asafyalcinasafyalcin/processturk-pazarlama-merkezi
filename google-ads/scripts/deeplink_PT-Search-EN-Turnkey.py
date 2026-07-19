#!/usr/bin/env python3
"""
Derin-bağlama — AG2/AG3 reklamlarının Final URL'ini kendi ürün sayfasına çeker.
(AG1 genel /en/hatlar listesinde kalır.)
"""
from _client import build_client, ACCOUNT_ID

CID = "23998449813"
MAP = {
    "Sauce & Paste Line": "https://www.processturk.com/en/hatlar/sos-uretim-hatti",
    "Dairy Milk Plant": "https://www.processturk.com/en/hatlar/sut-isleme-pastorizasyon-hatti",
}


def main():
    client = build_client()
    ga = client.get_service("GoogleAdsService")
    ad_service = client.get_service("AdService")

    ops = []
    for r in ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT ad_group.name, ad_group_ad.ad.resource_name "
        f"FROM ad_group_ad WHERE campaign.id={CID}")):
        name = r.ad_group.name
        if name in MAP:
            op = client.get_type("AdOperation")
            op.update.resource_name = r.ad_group_ad.ad.resource_name
            op.update.final_urls.append(MAP[name])
            op.update_mask.paths.append("final_urls")
            ops.append(op)
            print(f"  {name} → {MAP[name]}")

    if not ops:
        print("Güncellenecek reklam bulunamadı.")
        return
    ad_service.mutate_ads(customer_id=ACCOUNT_ID, operations=ops)
    print(f"✓ {len(ops)} reklamın Final URL'i derin-bağlandı.")


if __name__ == "__main__":
    main()
