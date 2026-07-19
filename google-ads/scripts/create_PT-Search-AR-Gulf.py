#!/usr/bin/env python3
"""
⚠️ EMEKLİ (2026-07-18): config-driven kurucuya taşındı.
    Yeni kullanım:  python3 scripts/create_campaign.py configs/PT-Search-AR-Gulf.json [--dry]
    Bu dosya tarihsel kayıt olarak duruyor — YENİ KAMPANYA BURADAN KOPYALANMAZ.
    NOT: canlı kampanyaya EN katmanı ekleyen add_en_groups_gulf.py AYRI ve HÂLÂ GEÇERLİDİR.

Körfez pazarı kampanyasını API ile kurar — PT-Search-AR-Gulf (Arapça · SA/AE/QA/KW/EG).
PAUSED oluşturur. Ürün/üslup Meta reklam sisteminden miras: Processturk_Pazarlama_Merkezi/
reklam/campaigns/C3-uretim-hatlari/creatives/sos-hatti/ (config.json + ad-copy.md, Asaf
tarafından zaten onaylı Arapça metin — gulf-cultural-guide: premium, resmi, fiyat ikincil).

Çalıştır: python3 scripts/create_PT-Search-AR-Gulf.py
Kuru test: python3 scripts/create_PT-Search-AR-Gulf.py --dry   (hiçbir şey oluşturmaz)
"""
import sys
from _client import build_client, ACCOUNT_ID

CAMPAIGN_NAME = "PT-Search-AR-Gulf"
DAILY_MICROS = 100_000_000         # ₺100/gün — yeni pazar testi, temkinli başlangıç
DEFAULT_CPC_MICROS = 30_000_000    # ₺30 — EN kampanyasının ₺8 dersi: düşük başlarsak rank-lost'a takılırız
FINAL_URL = "https://processturk.com/ar/hatlar"   # doğrulandı: 200, lang=ar, dir=rtl
GEO_IDS = [2414, 2634, 2682, 2784, 2818]   # Kuveyt, Katar, S.Arabistan, BAE, Mısır (Körfez seti — HEDEFLEME-MATRISI.md)
LANG_AR = "languageConstants/1019"

AD_GROUPS = {
    "Turnkey Line (AR)": {
        "keywords": [
            ("خط إنتاج جاهز", "PHRASE"), ("خط إنتاج تسليم مفتاح", "PHRASE"),
            ("مصنع تسليم مفتاح", "PHRASE"), ("مصنع جاهز بالكامل", "PHRASE"),
            ("إنشاء مصنع في تركيا", "PHRASE"), ("خط إنتاج غذائي متكامل", "PHRASE"),
            ("خط إنتاج جاهز", "EXACT"), ("مصنع تسليم مفتاح", "EXACT"),
        ],
        "headlines": [
            "خطوط إنتاج تسليم مفتاح", "صنع في تركيا", "من التصميم للتشغيل",
            "تركيب وتدريب شامل", "ستانلس ستيل 304 غذائي", "مكونات أوروبية",
            "مصنعك الكامل جاهز", "احصل على عرض سعر", "مصمم حسب طاقتك",
            "مصانع صناعية متكاملة", "تسليم وتركيب فوري", "هندسة ProcessTürk",
            "مورد واحد لكل شيء", "عرض سعر مجاني لمصنعك", "خط إنتاج بمواصفاتك",
        ],
    },
    "Sauce Line (AR)": {
        "keywords": [
            ("خط إنتاج الصلصة", "PHRASE"), ("خط إنتاج الكاتشب", "PHRASE"),
            ("مصنع معجون الطماطم", "PHRASE"), ("خط إنتاج المايونيز", "PHRASE"),
            ("مصنع صلصة تسليم مفتاح", "PHRASE"), ("خط إنتاج الصلصة", "EXACT"),
        ],
        "headlines": [
            "خط إنتاج الصلصة الكامل", "مصنع كاتشب تسليم مفتاح", "صنع في تركيا",
            "ستانلس ستيل 304 غذائي", "تركيب وتدريب شامل", "مكونات أوروبية",
            "من الطبخ إلى التغليف", "احصل على عرض سعر", "خطوط صلصة ومعجون",
            "مصمم حسب طاقتك", "مورد واحد لكل شيء", "هندسة ProcessTürk",
            "عرض سعر مجاني لمصنعك",
        ],
    },
    "Dairy Plant (AR)": {
        "keywords": [
            ("مصنع الألبان", "PHRASE"), ("خط إنتاج الحليب", "PHRASE"),
            ("خط إنتاج الزبادي", "PHRASE"), ("مصنع تعقيم الحليب", "PHRASE"),
            ("مصنع الألبان", "EXACT"),
        ],
        "headlines": [
            "مصانع ألبان متكاملة", "خط إنتاج الحليب والزبادي", "صنع في تركيا",
            "ستانلس ستيل 304 غذائي", "تركيب وتدريب شامل", "مكونات أوروبية",
            "بسترة وتعبئة متكاملة", "احصل على عرض سعر", "مصمم حسب طاقتك",
            "مورد واحد لكل شيء", "هندسة ProcessTürk", "عرض سعر مجاني لمصنعك",
        ],
    },
}

DESCRIPTIONS = [
    "خطوط إنتاج تسليم مفتاح من تركيا — تصميم، تركيب، تشغيل وتدريب لفريقك.",
    "ستانلس ستيل 304 غذائي ومكونات أوروبية — Siemens، Schneider، Festo.",
    "مورد واحد يتولى كل شيء، من الفكرة إلى خط الإنتاج الجاهز للعمل.",
    "احصل على عرض سعر مخصص لمصنعك اليوم. تواصل معنا لمعرفة التفاصيل.",
]

# EN listesiyle aynı (Körfez'de de İngilizce karışık arama/istismar terimleri görülüyor)
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
        print(f"[DRY] Kurulacak: 1 kampanya (PAUSED) · {len(AD_GROUPS)} reklam grubu · "
              f"{n_kw} anahtar kelime · {len(NEGATIVES)} negatif · {len(AD_GROUPS)} RSA")
        print(f"[DRY] Geo: {GEO_IDS} (KW/QA/SA/AE/EG) · Dil: AR · Bütçe ₺{DAILY_MICROS/1e6:.0f}/gün · "
              f"Manual CPC ₺{DEFAULT_CPC_MICROS/1e6:.0f} · URL {FINAL_URL}")
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
        b.amount_micros = DAILY_MICROS
        b.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
        b.explicitly_shared = False
        budget_rn = bsvc.mutate_campaign_budgets(
            customer_id=ACCOUNT_ID, operations=[bop]).results[0].resource_name
        print("✓ Bütçe oluşturuldu")

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

    ccsvc = client.get_service("CampaignCriterionService")
    ccops = []
    for gid in GEO_IDS:
        op = client.get_type("CampaignCriterionOperation")
        op.create.campaign = campaign_rn
        op.create.location.geo_target_constant = f"geoTargetConstants/{gid}"
        ccops.append(op)
    op = client.get_type("CampaignCriterionOperation")
    op.create.campaign = campaign_rn
    op.create.language.language_constant = LANG_AR
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
        ada.ad.final_urls.append(FINAL_URL)
        rsa = ada.ad.responsive_search_ad
        for h in data["headlines"]:
            a = client.get_type("AdTextAsset"); a.text = h; rsa.headlines.append(a)
        for d in DESCRIPTIONS:
            a = client.get_type("AdTextAsset"); a.text = d; rsa.descriptions.append(a)
        adops.append(op)
    adsvc.mutate_ad_group_ads(customer_id=ACCOUNT_ID, operations=adops)
    print(f"✓ {len(adops)} responsive search ad oluşturuldu")

    print("\n🎯 KAMPANYA HAZIR — DURUM: PAUSED (harcama yok, yayın Asaf onayına bağlı)")
    print(f"   Kampanya id: {campaign_id}")


if __name__ == "__main__":
    main()
