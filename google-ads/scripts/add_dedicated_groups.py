#!/usr/bin/env python3
"""
Dedike ürün sayfaları için yeni dar-temalı reklam grupları ekler + AG2'den örtüşen
kelimeleri çıkarır (iç rekabeti önlemek için). Kampanya: PT-Search-EN-Turnkey (23998449813).

Yeni gruplar:
  Tomato Paste (MACLINE) → /en/hatlar/moduler-salca-sistemi-macline
  Ketchup & Mayo         → /en/hatlar/sos-mayonez-ketcap-hatti
AG2 "Sauce & Paste Line" → "Sauce Line" olarak yeniden adlandırılır; paste/ketchup kelimeleri çıkarılır.
"""
from _client import build_client, ACCOUNT_ID

CID = "23998449813"
CAMPAIGN_RN = f"customers/{ACCOUNT_ID}/campaigns/{CID}"
DEFAULT_CPC = 8_000_000

# AG2'den çıkarılacak kelime metinleri (phrase+exact tüm eşleşenler)
REMOVE_TEXTS = {"tomato paste production line", "tomato paste plant", "ketchup production line"}

DESCS_PASTE = [
    "Turnkey tomato paste line from Türkiye, washing to aseptic filling. 6-50 tons per day.",
    "MACLINE modular system: hot/cold break, brix control, PLC+HMI. Food-grade AISI 304.",
    "Installation and operator training included. Trusted Turkish engineering for Africa.",
    "Get your tailored turnkey proposal today. Request a free project quote.",
]
DESCS_KETCHUP = [
    "Turnkey ketchup, mayonnaise and sauce line from Türkiye. 1-8 tons/day, food-grade 304.",
    "CIP cleaning, PLC control, European components. Cold and hot process options.",
    "Installation and operator training included. Trusted Turkish engineering for Africa.",
    "Get your tailored turnkey proposal today. Request a free project quote.",
]

NEW_GROUPS = {
    "Tomato Paste (MACLINE)": {
        "url": "https://www.processturk.com/en/hatlar/moduler-salca-sistemi-macline",
        "keywords": [
            ("tomato paste production line", "PHRASE"), ("tomato paste production line", "EXACT"),
            ("tomato paste plant", "PHRASE"), ("tomato paste line", "PHRASE"),
            ("tomato paste processing plant", "PHRASE"),
        ],
        "headlines": [
            "Tomato Paste Line", "Turnkey Tomato Paste Plant", "MACLINE Modular System",
            "6-12 Tons/Day Capacity", "Made in Türkiye", "Hot & Cold Break Options",
            "AISI 304 Food-Grade Steel", "Aseptic Bag, Can or Jar", "Get Your Project Quote",
            "Install & Training Included", "European-Grade Components", "Brix Control, PLC + HMI",
            "Scalable Paste Production", "Free Tailored Proposal", "ProcessTürk Engineering",
        ],
        "descriptions": DESCS_PASTE,
    },
    "Ketchup & Mayo": {
        "url": "https://www.processturk.com/en/hatlar/sos-mayonez-ketcap-hatti",
        "keywords": [
            ("ketchup production line", "PHRASE"), ("ketchup production line", "EXACT"),
            ("mayonnaise production line", "PHRASE"), ("ketchup plant", "PHRASE"),
            ("condiment production line", "PHRASE"),
        ],
        "headlines": [
            "Ketchup Production Line", "Mayonnaise Production Line", "Sauce, Mayo & Ketchup Line",
            "Turnkey Condiment Plant", "Made in Türkiye", "1-8 Tons/Day Capacity",
            "AISI 304 Food-Grade Steel", "Install & Training Included", "European-Grade Components",
            "Get Your Project Quote", "CIP Cleaning, PLC Control", "Cold & Hot Process Options",
            "Your Condiment Factory", "Free Tailored Proposal", "ProcessTürk Engineering",
        ],
        "descriptions": DESCS_KETCHUP,
    },
}


def main():
    client = build_client()
    ga = client.get_service("GoogleAdsService")

    # ZORUNLU: yeni grupların Final URL'leri AdsBot'a 200 dönüyor mu? (canlı kampanyaya
    # bozuk URL'li reklam eklemeyi önler — enable kapısı burada tetiklenmez)
    from url_kontrol import check_urls
    ok, rep = check_urls([d["url"] for d in NEW_GROUPS.values()])
    for u, (o, res) in rep.items():
        print(f"  {'✅' if o else '❌'} {u}  {res}")
    if not ok:
        sys.exit("⛔ Bir grup URL'si AdsBot'a 200 dönmüyor — HİÇBİR ŞEY EKLENMEDİ. Önce düzelt.")

    # Mükerrer koruma
    for name in NEW_GROUPS:
        hit = list(ga.search(customer_id=ACCOUNT_ID, query=(
            f"SELECT ad_group.name FROM ad_group WHERE campaign.id={CID} "
            f"AND ad_group.name = '{name}'")))
        if hit:
            print(f"⚠️ '{name}' zaten var — atlanıyor.")
            NEW_GROUPS.pop(name, None)

    # 1) AG2'yi bul → yeniden adlandır + örtüşen kelimeleri kaldır
    ag2_rn = None
    for r in ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT ad_group.resource_name FROM ad_group WHERE campaign.id={CID} "
        f"AND ad_group.name = 'Sauce & Paste Line'")):
        ag2_rn = r.ad_group.resource_name
    if ag2_rn:
        agsvc = client.get_service("AdGroupService")
        rn_op = client.get_type("AdGroupOperation")
        rn_op.update.resource_name = ag2_rn
        rn_op.update.name = "Sauce Line"
        rn_op.update_mask.paths.append("name")
        agsvc.mutate_ad_groups(customer_id=ACCOUNT_ID, operations=[rn_op])
        print("✓ AG2 → 'Sauce Line' olarak yeniden adlandırıldı")

        rm = []
        for r in ga.search(customer_id=ACCOUNT_ID, query=(
            f"SELECT ad_group_criterion.resource_name, ad_group_criterion.keyword.text "
            f"FROM ad_group_criterion WHERE ad_group.name = 'Sauce Line' "
            f"AND campaign.id={CID} AND ad_group_criterion.type = KEYWORD")):
            if r.ad_group_criterion.keyword.text.lower() in REMOVE_TEXTS:
                op = client.get_type("AdGroupCriterionOperation")
                op.remove = r.ad_group_criterion.resource_name
                rm.append(op)
        if rm:
            client.get_service("AdGroupCriterionService").mutate_ad_group_criteria(
                customer_id=ACCOUNT_ID, operations=rm)
            print(f"✓ AG2'den {len(rm)} örtüşen kelime kaldırıldı (paste/ketchup)")

    if not NEW_GROUPS:
        print("Yeni grup yok — bitti."); return

    # 2) Yeni reklam grupları
    agsvc = client.get_service("AdGroupService")
    ag_ops = []
    for name in NEW_GROUPS:
        op = client.get_type("AdGroupOperation")
        ag = op.create
        ag.name = name
        ag.campaign = CAMPAIGN_RN
        ag.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
        ag.cpc_bid_micros = DEFAULT_CPC
        ag.status = client.enums.AdGroupStatusEnum.ENABLED
        ag_ops.append(op)
    results = agsvc.mutate_ad_groups(customer_id=ACCOUNT_ID, operations=ag_ops).results
    ag_rns = {name: r.resource_name for name, r in zip(NEW_GROUPS, results)}
    print(f"✓ {len(ag_rns)} yeni reklam grubu oluşturuldu")

    # 3) Anahtar kelimeler
    kops = []
    for name, data in NEW_GROUPS.items():
        for text, match in data["keywords"]:
            op = client.get_type("AdGroupCriterionOperation")
            k = op.create
            k.ad_group = ag_rns[name]
            k.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
            k.keyword.text = text
            k.keyword.match_type = getattr(client.enums.KeywordMatchTypeEnum, match)
            kops.append(op)
    client.get_service("AdGroupCriterionService").mutate_ad_group_criteria(
        customer_id=ACCOUNT_ID, operations=kops)
    print(f"✓ {len(kops)} anahtar kelime eklendi")

    # 4) RSA (deep-linked)
    adops = []
    for name, data in NEW_GROUPS.items():
        op = client.get_type("AdGroupAdOperation")
        ada = op.create
        ada.ad_group = ag_rns[name]
        ada.status = client.enums.AdGroupAdStatusEnum.ENABLED
        ada.ad.final_urls.append(data["url"])
        rsa = ada.ad.responsive_search_ad
        for h in data["headlines"]:
            a = client.get_type("AdTextAsset"); a.text = h; rsa.headlines.append(a)
        for d in data["descriptions"]:
            a = client.get_type("AdTextAsset"); a.text = d; rsa.descriptions.append(a)
        rsa.path1 = "production"
        rsa.path2 = "turnkey"
        adops.append(op)
    client.get_service("AdGroupAdService").mutate_ad_group_ads(
        customer_id=ACCOUNT_ID, operations=adops)
    print(f"✓ {len(adops)} responsive search ad oluşturuldu (dedike sayfalara bağlı)")

    print("\n🎯 EKLENDİ — yeni gruplar CANLI kampanyada (kampanya ENABLED).")


if __name__ == "__main__":
    main()
