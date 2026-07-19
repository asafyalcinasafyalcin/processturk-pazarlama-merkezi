#!/usr/bin/env python3
"""
AR-Gulf kampanyasına (24020316122) İNGİLİZCE katman ekler — 2026-07-18 Asaf onayı.

Gerekçe: Arapça kelime seti Körfez'de neredeyse hiç aranmıyor (8 günde 3 gösterim;
CPC ₺50 + bütçe ₺200 artışları çözmedi → sorun teklif/bütçe değil, hacim).
Körfez'de B2B makine alıcıları ağırlıkla İngilizce arar.

Yaptıkları:
  1. Kampanya dil hedefine İngilizce (languageConstants/1000) ekler (AR kalır).
  2. EN-Turnkey'in (23998449813) 3 ana grubunun kelimelerini ve RSA reklamlarını okur.
  3. Final URL'leri url_kontrol.check_urls ile 200 doğrular (ZORUNLU KURAL).
  4. Gulf'ta "<ad> (EN-Gulf)" adlı yeni gruplar kurar (CPC ₺50) — grup adı varsa atlar
     (idempotent).

Kullanım:  python3 scripts/add_en_groups_gulf.py [--dry]
"""
import sys
from _client import build_client, ACCOUNT_ID
from url_kontrol import check_urls

GULF_ID = 24020316122
EN_ID = 23998449813
KAYNAK_GRUPLAR = ["Turnkey Production Line", "Sauce Line", "Dairy Milk Plant"]
CPC_MICROS = 50_000_000  # ₺50 — Gulf'ta çalıştığı kanıtlanan tavan

DRY = "--dry" in sys.argv


def main():
    client = build_client()
    ga = client.get_service("GoogleAdsService")

    # ── 1) Dil hedefi: EN ekle (varsa atla) ──
    diller = set()
    q = (f"SELECT campaign_criterion.language.language_constant FROM campaign_criterion "
         f"WHERE campaign.id = {GULF_ID} AND campaign_criterion.type = 'LANGUAGE'")
    for row in ga.search(customer_id=ACCOUNT_ID, query=q):
        diller.add(row.campaign_criterion.language.language_constant)
    en_const = "languageConstants/1000"
    if any(d.endswith("/1000") for d in diller):
        print("→ dil hedefi: İngilizce zaten ekli")
    elif DRY:
        print("→ [dry] dil hedefine İngilizce eklenecek")
    else:
        op = client.get_type("CampaignCriterionOperation")
        op.create.campaign = ga.campaign_path(ACCOUNT_ID, GULF_ID)
        op.create.language.language_constant = en_const
        client.get_service("CampaignCriterionService").mutate_campaign_criteria(
            customer_id=ACCOUNT_ID, operations=[op])
        print("→ dil hedefine İngilizce eklendi (AR korundu)")

    # ── 2) Kaynak grupların kelime + RSA'larını oku ──
    gruplar = {}  # ad → {id, kw: [(text, match)], ads: [ad_proto]}
    q = (f"SELECT ad_group.id, ad_group.name FROM ad_group "
         f"WHERE campaign.id = {EN_ID} AND ad_group.status != 'REMOVED'")
    for row in ga.search(customer_id=ACCOUNT_ID, query=q):
        if row.ad_group.name in KAYNAK_GRUPLAR:
            gruplar[row.ad_group.name] = {"id": row.ad_group.id, "kw": [], "ads": []}
    eksik = [g for g in KAYNAK_GRUPLAR if g not in gruplar]
    if eksik:
        sys.exit(f"Kaynak grup bulunamadı: {eksik}")

    for ad, g in gruplar.items():
        q = (f"SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type "
             f"FROM ad_group_criterion WHERE ad_group.id = {g['id']} "
             f"AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE "
             f"AND ad_group_criterion.status != 'REMOVED'")
        for row in ga.search(customer_id=ACCOUNT_ID, query=q):
            k = row.ad_group_criterion.keyword
            g["kw"].append((k.text, k.match_type))
        q = (f"SELECT ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines, "
             f"ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.responsive_search_ad.path1, "
             f"ad_group_ad.ad.responsive_search_ad.path2 "
             f"FROM ad_group_ad WHERE ad_group.id = {g['id']} AND ad_group_ad.status != 'REMOVED'")
        for row in ga.search(customer_id=ACCOUNT_ID, query=q):
            g["ads"].append(row.ad_group_ad.ad)
        print(f"→ kaynak '{ad}': {len(g['kw'])} kelime, {len(g['ads'])} reklam")

    # ── 3) URL kontrolü (ZORUNLU) ──
    urls = sorted({u for g in gruplar.values() for a in g["ads"] for u in a.final_urls})
    print(f"→ URL kontrolü: {urls}")
    hepsi_ok, rapor = check_urls(urls)
    if not hepsi_ok:
        kirik = [u for u, (ok, _) in rapor.items() if not ok]
        sys.exit(f"⛔ URL doğrulaması BAŞARISIZ, kurulmadı: {kirik}")
    print("→ tüm URL'ler 200 ✓")

    if DRY:
        print("[dry] değişiklik yapılmadı."); return

    # ── 4) Gulf'ta yeni gruplar (idempotent) ──
    mevcut = set()
    q = (f"SELECT ad_group.name FROM ad_group WHERE campaign.id = {GULF_ID} "
         f"AND ad_group.status != 'REMOVED'")
    for row in ga.search(customer_id=ACCOUNT_ID, query=q):
        mevcut.add(row.ad_group.name)

    ag_svc = client.get_service("AdGroupService")
    crit_svc = client.get_service("AdGroupCriterionService")
    ad_svc = client.get_service("AdGroupAdService")

    for ad, g in gruplar.items():
        yeni_ad = f"{ad} (EN-Gulf)"
        if yeni_ad in mevcut:
            print(f"→ '{yeni_ad}' zaten var, atlandı"); continue
        op = client.get_type("AdGroupOperation")
        op.create.name = yeni_ad
        op.create.campaign = ga.campaign_path(ACCOUNT_ID, GULF_ID)
        op.create.status = client.enums.AdGroupStatusEnum.ENABLED
        op.create.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
        op.create.cpc_bid_micros = CPC_MICROS
        yeni = ag_svc.mutate_ad_groups(customer_id=ACCOUNT_ID, operations=[op])
        ag_res = yeni.results[0].resource_name

        kw_ops = []
        for text, match in g["kw"]:
            kop = client.get_type("AdGroupCriterionOperation")
            kop.create.ad_group = ag_res
            kop.create.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
            kop.create.keyword.text = text
            kop.create.keyword.match_type = match
            kw_ops.append(kop)
        if kw_ops:
            crit_svc.mutate_ad_group_criteria(customer_id=ACCOUNT_ID, operations=kw_ops)

        ad_ops = []
        for kaynak_ad in g["ads"]:
            aop = client.get_type("AdGroupAdOperation")
            aop.create.ad_group = ag_res
            aop.create.status = client.enums.AdGroupAdStatusEnum.ENABLED
            a = aop.create.ad
            a.final_urls.extend(list(kaynak_ad.final_urls))
            rsa = a.responsive_search_ad
            for h in kaynak_ad.responsive_search_ad.headlines:
                yh = client.get_type("AdTextAsset"); yh.text = h.text
                if h.pinned_field: yh.pinned_field = h.pinned_field
                rsa.headlines.append(yh)
            for d in kaynak_ad.responsive_search_ad.descriptions:
                yd = client.get_type("AdTextAsset"); yd.text = d.text
                if d.pinned_field: yd.pinned_field = d.pinned_field
                rsa.descriptions.append(yd)
            if kaynak_ad.responsive_search_ad.path1: rsa.path1 = kaynak_ad.responsive_search_ad.path1
            if kaynak_ad.responsive_search_ad.path2: rsa.path2 = kaynak_ad.responsive_search_ad.path2
            ad_ops.append(aop)
        if ad_ops:
            ad_svc.mutate_ad_group_ads(customer_id=ACCOUNT_ID, operations=ad_ops)
        print(f"✓ '{yeni_ad}': {len(kw_ops)} kelime + {len(ad_ops)} reklam kuruldu (CPC ₺{CPC_MICROS/1e6:.0f})")

    print("\nTamam. Yeni reklamlar Google incelemesine girer (birkaç saat).")


if __name__ == "__main__":
    main()
