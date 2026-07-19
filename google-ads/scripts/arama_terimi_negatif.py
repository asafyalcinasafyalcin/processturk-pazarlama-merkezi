#!/usr/bin/env python3
"""
Arama-terimi madenciliği → negatif kelime önerisi.
Reklamın TETİKLENDİĞİ gerçek aramalara bakar; alakasız/çöp olanları işaretler.
Varsayılan: yalnız ÖNERİR (hiçbir şey değiştirmez).
--apply : işaretlenenleri kampanya negatifi olarak EKLER (yalnız harcamayı azaltır, güvenli).

Kullanım:
  python3 scripts/arama_terimi_negatif.py            # öneri (dry)
  python3 scripts/arama_terimi_negatif.py --apply    # uygula
"""
import sys
from _client import build_client, ACCOUNT_ID

CID = "23998449813"
CAMPAIGN_RN = f"customers/{ACCOUNT_ID}/campaigns/{CID}"

# Çöp/alakasız sinyaller (arama terimi bunlardan birini içeriyorsa aday)
JUNK = [
    "free", "used", "second hand", "2nd hand", "diy", "homemade", "job", "jobs", "salary",
    "vacancy", "hiring", "career", "pdf", "ppt", "drawing", "cad", "layout", "diagram",
    "repair", "spare", "rental", "rent", "for rent", "price list", "cheap", "manual",
    "how to make", "youtube", "video", "wikipedia", "meaning", "definition", "course",
    "training", "student", "project report", "thesis", "toy", "game", "mini",
]


def main():
    apply = "--apply" in sys.argv
    client = build_client(); ga = client.get_service("GoogleAdsService")

    # mevcut negatifler (mükerrer eklememek için)
    existing = set()
    for r in ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT campaign_criterion.keyword.text FROM campaign_criterion "
        f"WHERE campaign.id={CID} AND campaign_criterion.negative=true")):
        existing.add(r.campaign_criterion.keyword.text.lower())

    flagged = {}  # term -> reason
    for r in ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT search_term_view.search_term, metrics.clicks, metrics.cost_micros, "
        f"metrics.conversions FROM search_term_view WHERE campaign.id={CID} "
        f"AND segments.date DURING LAST_30_DAYS")):
        term = r.search_term_view.search_term.lower()
        if term in existing or term in flagged:
            continue
        cost = r.metrics.cost_micros / 1_000_000
        conv = r.metrics.conversions
        junk = next((j for j in JUNK if j in term), None)
        if junk:
            flagged[term] = f"çöp sinyali '{junk}'"
        elif cost >= 40 and conv == 0:
            flagged[term] = f"₺{cost:.0f} harcadı, 0 dönüşüm"

    if not flagged:
        print("Eklenecek negatif önerisi yok (henüz yeterli arama verisi olmayabilir).")
        return

    print(f"{len(flagged)} negatif adayı:")
    for t, why in flagged.items():
        print(f"  - \"{t}\"  ({why})")

    if not apply:
        print("\n(Öneri modu — hiçbir şey değişmedi. Uygulamak için: --apply)")
        return

    ops = []
    for t in flagged:
        op = client.get_type("CampaignCriterionOperation")
        op.create.campaign = CAMPAIGN_RN
        op.create.negative = True
        op.create.keyword.text = t
        op.create.keyword.match_type = (
            client.enums.KeywordMatchTypeEnum.PHRASE if " " in t
            else client.enums.KeywordMatchTypeEnum.EXACT)
        ops.append(op)
    client.get_service("CampaignCriterionService").mutate_campaign_criteria(
        customer_id=ACCOUNT_ID, operations=ops)
    print(f"\n✓ {len(ops)} negatif kelime eklendi (harcama korundu).")


if __name__ == "__main__":
    main()
