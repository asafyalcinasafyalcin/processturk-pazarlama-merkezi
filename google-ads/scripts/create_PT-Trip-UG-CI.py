#!/usr/bin/env python3
"""
⚠️ EMEKLİ (2026-07-18): config-driven kurucuya taşındı.
    Yeni kullanım:  python3 scripts/create_campaign.py configs/PT-Trip-UG-CI.json [--dry]
    (süre artık config'teki duration_days: 10 alanından gelir)
    Bu dosya tarihsel kayıt olarak duruyor — YENİ KAMPANYA BURADAN KOPYALANMAZ.

Uganda + Fildişi Sahili gezi-zamanlı kampanyası — PT-Trip-UG-CI.
10 gün: start_date_time'dan itibaren 5 gün YOĞUN bütçe + 5 gün HAFİF bütçe (bu script'in
kendisi bütçeyi değiştirmez — gün 5'te elle/istek üzerine `butce_guncelle.py` ile
HAFIF_TL'ye düşürülür, bkz. çıktıdaki hatırlatma). end_date_time ile kampanya 10. günün
sonunda otomatik durur (Google Ads native — ekstra script gerekmez).
PAUSED oluşturur. EN içerik create_PT-Search-EN-Turnkey.py ile aynı (kanıtlanmış).
FR içerik Meta sisteminden miras: reklam/campaigns/C3-uretim-hatlari/creatives/sos-hatti/ad-copy.md

Çalıştır: python3 scripts/create_PT-Trip-UG-CI.py
Kuru test: python3 scripts/create_PT-Trip-UG-CI.py --dry
"""
import sys
from datetime import datetime, timedelta
from _client import build_client, ACCOUNT_ID

CAMPAIGN_NAME = "PT-Trip-UG-CI"
YOGUN_MICROS = 150_000_000    # ₺150/gün — ilk 5 gün (gezi öncesi/sırası, yoğun)
HAFIF_MICROS = 60_000_000     # ₺60/gün — son 5 gün (gün 5'te elle düşürülecek, bkz. NOT)
CPC_MICROS = 35_000_000       # ₺35 — düşükten başlamama dersi uygulandı
GEO_IDS = [2800, 2384]        # Uganda, Fildişi Sahili (Côte d'Ivoire)
LANG_EN = "languageConstants/1000"
LANG_FR = "languageConstants/1002"
FINAL_URL_EN = "https://processturk.com/en/hatlar"
FINAL_URL_FR = "https://processturk.com/fr/hatlar"

TODAY = datetime.now()
START_DT = TODAY.strftime("%Y-%m-%d 00:00:00")
END_DT = (TODAY + timedelta(days=9)).strftime("%Y-%m-%d 23:59:59")
YOGUN_BITIS = (TODAY + timedelta(days=4)).strftime("%Y-%m-%d")

AD_GROUPS = {
    # --- İngilizce (Uganda) — EN-Turnkey ile aynı kanıtlanmış içerik ---
    "Turnkey Line (EN)": {
        "lang": "en",
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
            "Turnkey Industrial Plants", "Delivered & Installed", "Your Factory, Turnkey",
            "Free Tailored Proposal", "ProcessTürk Engineering",
        ],
        "descriptions": [
            "Turnkey production lines from Türkiye — engineered, built, installed and commissioned.",
            "Food-grade AISI 304, European components, PLC control. Scaled to your target capacity.",
            "Installation and operator training included. Trusted Turkish engineering for Africa.",
            "Get your tailored turnkey proposal today. Request a free project quote.",
        ],
    },
    "Sauce Line (EN)": {
        "lang": "en",
        "keywords": [
            ("sauce production line", "PHRASE"), ("tomato paste production line", "PHRASE"),
            ("tomato paste plant", "PHRASE"), ("ketchup production line", "PHRASE"),
            ("sauce production line", "EXACT"),
        ],
        "headlines": [
            "Sauce Production Line", "Tomato Paste Plant Turnkey", "Ketchup & Sauce Lines",
            "Made in Türkiye", "AISI 304 Food-Grade Steel", "Install & Training Included",
            "European-Grade Components", "Get Your Project Quote", "Delivered & Installed",
            "Turnkey Food Plants", "Free Tailored Proposal", "ProcessTürk Engineering",
        ],
        "descriptions": [
            "Turnkey production lines from Türkiye — engineered, built, installed and commissioned.",
            "Food-grade AISI 304, European components, PLC control. Scaled to your target capacity.",
            "Installation and operator training included. Trusted Turkish engineering for Africa.",
            "Get your tailored turnkey proposal today. Request a free project quote.",
        ],
    },
    "Dairy Plant (EN)": {
        "lang": "en",
        "keywords": [
            ("milk processing plant", "PHRASE"), ("yoghurt production line", "PHRASE"),
            ("dairy processing plant", "PHRASE"), ("milk plant turnkey", "PHRASE"),
            ("milk processing plant", "EXACT"),
        ],
        "headlines": [
            "Milk Processing Plant", "Yoghurt Production Line", "Dairy Plant Turnkey",
            "Made in Türkiye", "Pasteurization & Filling", "AISI 304 Food-Grade Steel",
            "Get Your Project Quote", "Install & Training Included", "European-Grade Components",
            "Complete Dairy Line", "Free Tailored Proposal", "ProcessTürk Engineering",
        ],
        "descriptions": [
            "Turnkey production lines from Türkiye — engineered, built, installed and commissioned.",
            "Food-grade AISI 304, European components, PLC control. Scaled to your target capacity.",
            "Installation and operator training included. Trusted Turkish engineering for Africa.",
            "Get your tailored turnkey proposal today. Request a free project quote.",
        ],
    },
    # --- Fransızca (Fildişi Sahili) — Meta ad-copy.md FR bölümünden miras ---
    "Turnkey Line (FR)": {
        "lang": "fr",
        "keywords": [
            ("ligne de production clé en main", "PHRASE"), ("usine clé en main", "PHRASE"),
            ("installation usine turquie", "PHRASE"), ("ligne de production complète", "PHRASE"),
            ("ligne de production clé en main", "EXACT"),
        ],
        "headlines": [
            "Ligne Production Clé en Main", "Usine Complète, Un Partenaire", "Fabriqué en Türkiye",
            "Installation + Formation", "Inox 304 Alimentaire", "Composants Européens",
            "Devis de Projet Gratuit", "Conçue Selon Votre Capacité", "Usines Clé en Main",
            "Livrée et Installée", "Ingénierie ProcessTürk",
        ],
        "descriptions": [
            "Lignes de production clé en main depuis la Türkiye — conception à l'installation.",
            "Acier inox 304 alimentaire, composants européens, contrôle PLC. Selon votre capacité.",
            "Installation et formation des opérateurs incluses. Ingénierie turque de confiance.",
            "Recevez votre devis clé en main personnalisé. Demandez un devis gratuit.",
        ],
    },
    "Sauce Line (FR)": {
        "lang": "fr",
        "keywords": [
            ("ligne de production de sauce", "PHRASE"), ("ligne de production de ketchup", "PHRASE"),
            ("usine de concentré de tomate", "PHRASE"), ("ligne de production de sauce", "EXACT"),
        ],
        "headlines": [
            "Ligne de Production de Sauce", "Usine de Concentré de Tomate", "Fabriqué en Türkiye",
            "Inox 304 Alimentaire", "Installation + Formation", "Composants Européens",
            "Devis de Projet Gratuit", "Livrée et Installée", "Ingénierie ProcessTürk",
        ],
        "descriptions": [
            "Lignes de production clé en main depuis la Türkiye — conception à l'installation.",
            "Acier inox 304 alimentaire, composants européens, contrôle PLC. Selon votre capacité.",
            "Installation et formation des opérateurs incluses. Ingénierie turque de confiance.",
            "Recevez votre devis clé en main personnalisé. Demandez un devis gratuit.",
        ],
    },
    "Dairy Plant (FR)": {
        "lang": "fr",
        "keywords": [
            ("usine laitière", "PHRASE"), ("ligne de production de lait", "PHRASE"),
            ("ligne de production de yaourt", "PHRASE"), ("usine laitière", "EXACT"),
        ],
        "headlines": [
            "Usine Laitière Clé en Main", "Ligne de Production de Lait", "Fabriqué en Türkiye",
            "Pasteurisation et Remplissage", "Inox 304 Alimentaire", "Composants Européens",
            "Devis de Projet Gratuit", "Installation + Formation", "Ingénierie ProcessTürk",
        ],
        "descriptions": [
            "Lignes de production clé en main depuis la Türkiye — conception à l'installation.",
            "Acier inox 304 alimentaire, composants européens, contrôle PLC. Selon votre capacité.",
            "Installation et formation des opérateurs incluses. Ingénierie turque de confiance.",
            "Recevez votre devis clé en main personnalisé. Demandez un devis gratuit.",
        ],
    },
}

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
        print(f"[DRY] Kurulacak: 1 kampanya (PAUSED) · {len(AD_GROUPS)} reklam grubu (3 EN + 3 FR) · "
              f"{n_kw} anahtar kelime · {len(NEGATIVES)} negatif")
        print(f"[DRY] Geo: Uganda+Fildişi · Dil: EN+FR · Tarih: {START_DT} → {END_DT}")
        print(f"[DRY] Bütçe: ₺{YOGUN_MICROS/1e6:.0f}/gün (ilk 5 gün, {YOGUN_BITIS}'e kadar) → "
              f"sonra elle ₺{HAFIF_MICROS/1e6:.0f}/gün'e düşür · CPC ₺{CPC_MICROS/1e6:.0f}")
        print("[DRY] Gerçekten kurmak için --dry olmadan çalıştır.")
        return

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
        b.amount_micros = YOGUN_MICROS
        b.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
        b.explicitly_shared = False
        budget_rn = bsvc.mutate_campaign_budgets(
            customer_id=ACCOUNT_ID, operations=[bop]).results[0].resource_name
        print(f"✓ Bütçe oluşturuldu (₺{YOGUN_MICROS/1e6:.0f}/gün, yoğun faz)")

    csvc = client.get_service("CampaignService")
    cop = client.get_type("CampaignOperation")
    c = cop.create
    c.name = CAMPAIGN_NAME
    c.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.SEARCH
    c.status = client.enums.CampaignStatusEnum.PAUSED
    c.campaign_budget = budget_rn
    c.start_date_time = START_DT
    c.end_date_time = END_DT
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
    print(f"✓ Kampanya oluşturuldu (PAUSED) — id {campaign_id} · {START_DT} → {END_DT}")

    ccsvc = client.get_service("CampaignCriterionService")
    ccops = []
    for gid in GEO_IDS:
        op = client.get_type("CampaignCriterionOperation")
        op.create.campaign = campaign_rn
        op.create.location.geo_target_constant = f"geoTargetConstants/{gid}"
        ccops.append(op)
    for lang in (LANG_EN, LANG_FR):
        op = client.get_type("CampaignCriterionOperation")
        op.create.campaign = campaign_rn
        op.create.language.language_constant = lang
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
    print(f"✓ {len(GEO_IDS)} konum + 2 dil + {len(NEGATIVES)} negatif eklendi")

    agsvc = client.get_service("AdGroupService")
    agops = []
    for name in AD_GROUPS:
        op = client.get_type("AdGroupOperation")
        ag = op.create
        ag.name = name
        ag.campaign = campaign_rn
        ag.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
        ag.cpc_bid_micros = CPC_MICROS
        ag.status = client.enums.AdGroupStatusEnum.ENABLED
        agops.append(op)
    ag_results = agsvc.mutate_ad_groups(customer_id=ACCOUNT_ID, operations=agops).results
    ag_rns = {name: r.resource_name for name, r in zip(AD_GROUPS, ag_results)}
    print(f"✓ {len(ag_rns)} reklam grubu oluşturuldu")

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

    adsvc = client.get_service("AdGroupAdService")
    adops = []
    for name, data in AD_GROUPS.items():
        op = client.get_type("AdGroupAdOperation")
        ada = op.create
        ada.ad_group = ag_rns[name]
        ada.status = client.enums.AdGroupAdStatusEnum.ENABLED
        ada.ad.final_urls.append(FINAL_URL_EN if data["lang"] == "en" else FINAL_URL_FR)
        rsa = ada.ad.responsive_search_ad
        for h in data["headlines"]:
            a = client.get_type("AdTextAsset"); a.text = h; rsa.headlines.append(a)
        for d in data["descriptions"]:
            a = client.get_type("AdTextAsset"); a.text = d; rsa.descriptions.append(a)
        adops.append(op)
    adsvc.mutate_ad_group_ads(customer_id=ACCOUNT_ID, operations=adops)
    print(f"✓ {len(adops)} responsive search ad oluşturuldu")

    print("\n🎯 KAMPANYA HAZIR — DURUM: PAUSED (harcama yok, yayın Asaf onayına bağlı)")
    print(f"   Kampanya id: {campaign_id}")
    print(f"   ⏰ HATIRLATMA: {YOGUN_BITIS} itibariyle bütçeyi ₺{HAFIF_MICROS/1e6:.0f}/gün'e düşür:")
    print(f"   python3 scripts/butce_guncelle.py {campaign_id} {HAFIF_MICROS/1e6:.0f} --apply")


if __name__ == "__main__":
    main()
