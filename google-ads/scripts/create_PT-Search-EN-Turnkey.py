#!/usr/bin/env python3
"""
⚠️ EMEKLİ (2026-07-18): config-driven kurucuya taşındı.
    Yeni kullanım:  python3 scripts/create_campaign.py configs/PT-Search-EN-Turnkey.json [--dry]
    Bu dosya tarihsel kayıt olarak duruyor — YENİ KAMPANYA BURADAN KOPYALANMAZ.

İlk kampanyayı API ile kurar — PT-Search-EN-Turnkey (Anahtar-teslim üretim hattı · Afrika-EN+UG).
PAUSED oluşturur. Kaynak spec: editor-uploads/PT-Search-EN-Turnkey.md

Çalıştır: python3 scripts/create_PT-Search-EN-Turnkey.py
Kuru test: python3 scripts/create_PT-Search-EN-Turnkey.py --dry   (hiçbir şey oluşturmaz)
"""
import sys
from _client import build_client, ACCOUNT_ID

CAMPAIGN_NAME = "PT-Search-EN-Turnkey"
DAILY_MICROS = 100_000_000        # ₺100/gün
DEFAULT_CPC_MICROS = 8_000_000    # ₺8 varsayılan TBM (Manual CPC — sonra akıllı teklife geçilir)
FINAL_URL = "https://www.processturk.com/en/hatlar"
GEO_IDS = [2566, 2288, 2404, 2800]   # Nijerya, Gana, Kenya, Uganda
LANG_EN = "languageConstants/1000"

AD_GROUPS = {
    "Turnkey Production Line": {
        "keywords": [
            ("turnkey production line", "PHRASE"), ("turnkey manufacturing plant", "PHRASE"),
            ("complete production line", "PHRASE"), ("turnkey factory setup", "PHRASE"),
            ("turnkey plant supplier", "PHRASE"), ("production line manufacturer turkey", "PHRASE"),
            ("turnkey production line", "EXACT"), ("turnkey plant", "EXACT"),
        ],
        "headlines": [
            "Turnkey Production Lines", "Complete Line, One Partner", "Design to Commissioning",
            "Made in Türkiye", "Install & Training Included", "European-Grade Components",
            "AISI 304 Food-Grade Steel", "Get Your Project Quote", "Built to Your Capacity",
            "Turnkey Industrial Plants", "Delivered & Installed", "Sauce, Paste & Dairy Lines",
            "Your Factory, Turnkey", "Free Tailored Proposal", "ProcessTürk Engineering",
        ],
    },
    "Sauce & Paste Line": {
        "keywords": [
            ("sauce production line", "PHRASE"), ("tomato paste production line", "PHRASE"),
            ("tomato paste plant", "PHRASE"), ("ketchup production line", "PHRASE"),
            ("jam production line", "PHRASE"), ("food processing line turnkey", "PHRASE"),
            ("sauce production line", "EXACT"), ("tomato paste production line", "EXACT"),
        ],
        "headlines": [
            "Sauce Production Line", "Tomato Paste Plant Turnkey", "Ketchup & Sauce Lines",
            "Made in Türkiye", "AISI 304 Food-Grade Steel", "Install & Training Included",
            "European-Grade Components", "Get Your Project Quote", "Built to Your Capacity",
            "Design to Commissioning", "Delivered & Installed", "PLC & Automation Control",
            "Turnkey Food Plants", "Free Tailored Proposal", "ProcessTürk Engineering",
        ],
    },
    "Dairy Milk Plant": {
        "keywords": [
            ("milk processing plant", "PHRASE"), ("yoghurt production line", "PHRASE"),
            ("dairy processing plant", "PHRASE"), ("milk pasteurization line", "PHRASE"),
            ("milk plant turnkey", "PHRASE"), ("milk processing plant", "EXACT"),
            ("dairy plant", "EXACT"),
        ],
        "headlines": [
            "Milk Processing Plant", "Yoghurt Production Line", "Dairy Plant Turnkey",
            "Made in Türkiye", "20 Ton/Day & Scalable", "Pasteurization & Filling",
            "AISI 304 Food-Grade Steel", "Get Your Project Quote", "Install & Training Included",
            "European-Grade Components", "Delivered in 65-75 Days", "Complete Dairy Line",
            "Your Factory, Turnkey", "Free Tailored Proposal", "ProcessTürk Engineering",
        ],
    },
}

DESCRIPTIONS = [
    "Turnkey production lines from Türkiye — engineered, built, installed and commissioned.",
    "Food-grade AISI 304, European components, PLC control. Scaled to your target capacity.",
    "Installation and operator training included. Trusted Turkish engineering for Africa.",
    "Get your tailored turnkey proposal today. Request a free project quote.",
]

NEGATIVES = [
    "free", "pdf", "ppt", "download", "drawing", "cad", "layout", "diagram", "template",
    "project report", "thesis", "wikipedia", "what is", "meaning", "definition", "job",
    "jobs", "career", "salary", "vacancy", "hiring", "internship", "course", "training",
    "tutorial", "used", "second hand", "refurbished", "rental", "rent", "lease",
    "spare parts", "repair", "diy", "homemade", "toy", "game", "software", "simulation",
    "price list",
]


def main():
    dry = "--dry" in sys.argv
    client = build_client()
    ga = client.get_service("GoogleAdsService")

    # Mükerrer kurulum koruması (--reset ile mevcut kampanyayı kaldırıp yeniden kurar)
    exists = list(ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT campaign.resource_name FROM campaign "
        f"WHERE campaign.name = '{CAMPAIGN_NAME}' AND campaign.status != 'REMOVED'")))
    if exists:
        if "--reset" in sys.argv:
            rmop = client.get_type("CampaignOperation")
            rmop.remove = exists[0].campaign.resource_name
            client.get_service("CampaignService").mutate_campaigns(
                customer_id=ACCOUNT_ID, operations=[rmop])
            print("↺ Mevcut (kısmi) kampanya kaldırıldı — yeniden kuruluyor")
        else:
            sys.exit(f"⛔ '{CAMPAIGN_NAME}' zaten var. Yeniden kurmak için: --reset")

    if dry:
        n_kw = sum(len(v["keywords"]) for v in AD_GROUPS.values())
        print(f"[DRY] Kurulacak: 1 kampanya (PAUSED) · {len(AD_GROUPS)} reklam grubu · "
              f"{n_kw} anahtar kelime · {len(NEGATIVES)} negatif · {len(AD_GROUPS)} RSA")
        print(f"[DRY] Geo: {GEO_IDS} · Dil: EN · Bütçe ₺100/gün · Manual CPC ₺8 · URL {FINAL_URL}")
        print("[DRY] Gerçekten kurmak için --dry olmadan çalıştır.")
        return

    # 1) Bütçe (varsa yeniden kullan → mükerrer orphan bütçe olmaz)
    bsvc = client.get_service("CampaignBudgetService")
    budget_name = f"{CAMPAIGN_NAME} Budget"
    existing_b = list(ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT campaign_budget.resource_name FROM campaign_budget "
        f"WHERE campaign_budget.name = '{budget_name}' LIMIT 1")))
    if existing_b:
        budget_rn = existing_b[0].campaign_budget.resource_name
        print("✓ Mevcut bütçe yeniden kullanıldı")
    else:
        bop = client.get_type("CampaignBudgetOperation")
        b = bop.create
        b.name = budget_name
        b.amount_micros = DAILY_MICROS
        b.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
        b.explicitly_shared = False
        budget_rn = bsvc.mutate_campaign_budgets(
            customer_id=ACCOUNT_ID, operations=[bop]).results[0].resource_name
        print("✓ Bütçe oluşturuldu")

    # 2) Kampanya (SEARCH, PAUSED, Manual CPC, yalnız Google Arama)
    csvc = client.get_service("CampaignService")
    cop = client.get_type("CampaignOperation")
    c = cop.create
    c.name = CAMPAIGN_NAME
    c.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.SEARCH
    c.status = client.enums.CampaignStatusEnum.PAUSED
    c.campaign_budget = budget_rn
    c.contains_eu_political_advertising = (
        client.enums.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING)
    c.manual_cpc = client.get_type("ManualCpc")
    c.network_settings.target_google_search = True
    c.network_settings.target_search_network = False
    c.network_settings.target_content_network = False
    c.network_settings.target_partner_search_network = False
    campaign_rn = csvc.mutate_campaigns(
        customer_id=ACCOUNT_ID, operations=[cop]).results[0].resource_name
    campaign_id = campaign_rn.split("/")[-1]
    print(f"✓ Kampanya oluşturuldu (PAUSED) — id {campaign_id}")

    # 3) Kampanya kriterleri: geo + dil + negatifler
    ccsvc = client.get_service("CampaignCriterionService")
    ccops = []
    for gid in GEO_IDS:
        op = client.get_type("CampaignCriterionOperation")
        op.create.campaign = campaign_rn
        op.create.location.geo_target_constant = f"geoTargetConstants/{gid}"
        ccops.append(op)
    op = client.get_type("CampaignCriterionOperation")
    op.create.campaign = campaign_rn
    op.create.language.language_constant = LANG_EN
    ccops.append(op)
    for kw in NEGATIVES:
        op = client.get_type("CampaignCriterionOperation")
        op.create.campaign = campaign_rn
        op.create.negative = True
        op.create.keyword.text = kw
        op.create.keyword.match_type = (
            client.enums.KeywordMatchTypeEnum.PHRASE if " " in kw
            else client.enums.KeywordMatchTypeEnum.BROAD)
        ccops.append(op)
    ccsvc.mutate_campaign_criteria(customer_id=ACCOUNT_ID, operations=ccops)
    print(f"✓ {len(GEO_IDS)} konum + dil + {len(NEGATIVES)} negatif eklendi")

    # 4) Reklam grupları
    agsvc = client.get_service("AdGroupService")
    agops = []
    for name in AD_GROUPS:
        op = client.get_type("AdGroupOperation")
        ag = op.create
        ag.name = name
        ag.campaign = campaign_rn
        ag.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
        ag.cpc_bid_micros = DEFAULT_CPC_MICROS
        ag.status = client.enums.AdGroupStatusEnum.ENABLED
        agops.append(op)
    ag_results = agsvc.mutate_ad_groups(customer_id=ACCOUNT_ID, operations=agops).results
    ag_rns = {name: r.resource_name for name, r in zip(AD_GROUPS, ag_results)}
    print(f"✓ {len(ag_rns)} reklam grubu oluşturuldu")

    # 5) Anahtar kelimeler
    kcsvc = client.get_service("AdGroupCriterionService")
    kops = []
    for name, data in AD_GROUPS.items():
        for text, match in data["keywords"]:
            op = client.get_type("AdGroupCriterionOperation")
            k = op.create
            k.ad_group = ag_rns[name]
            k.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
            k.keyword.text = text
            k.keyword.match_type = getattr(client.enums.KeywordMatchTypeEnum, match)
            kops.append(op)
    kcsvc.mutate_ad_group_criteria(customer_id=ACCOUNT_ID, operations=kops)
    print(f"✓ {len(kops)} anahtar kelime eklendi")

    # 6) Responsive Search Ad (her grup)
    adsvc = client.get_service("AdGroupAdService")
    adops = []
    for name, data in AD_GROUPS.items():
        op = client.get_type("AdGroupAdOperation")
        ada = op.create
        ada.ad_group = ag_rns[name]
        ada.status = client.enums.AdGroupAdStatusEnum.ENABLED
        ada.ad.final_urls.append(FINAL_URL)
        rsa = ada.ad.responsive_search_ad
        for h in data["headlines"]:
            a = client.get_type("AdTextAsset"); a.text = h; rsa.headlines.append(a)
        for d in DESCRIPTIONS:
            a = client.get_type("AdTextAsset"); a.text = d; rsa.descriptions.append(a)
        rsa.path1 = "production"
        rsa.path2 = "turnkey"
        adops.append(op)
    adsvc.mutate_ad_group_ads(customer_id=ACCOUNT_ID, operations=adops)
    print(f"✓ {len(adops)} responsive search ad oluşturuldu")

    print("\n🎯 KAMPANYA HAZIR — DURUM: PAUSED (harcama yok, yayın Asaf onayına bağlı)")
    print(f"   Ads'te gör: https://ads.google.com/aw/campaigns?ocid=&campaignId={campaign_id}")
    print(f"   Kampanya id: {campaign_id}")


if __name__ == "__main__":
    main()
