#!/usr/bin/env python3
"""
Bütçe/performans guardrail — parayı boşa yakan yerleri yakalar, uyarır.
Varsayılan: yalnız UYARIR. --apply : yalnızca 0-dönüşümlü para yakan kelimeleri DURAKLATIR
(harcamayı azaltır, güvenli). BÜTÇE ARTIRIMI ASLA otomatik yapılmaz — yalnız Asaf onayıyla.

Kullanım:
  python3 scripts/guardrail.py                 # uyarı raporu
  python3 scripts/guardrail.py --apply          # kötü kelimeleri duraklat
Ayarlanabilir eşikler aşağıda (CPL_HEDEF, ISRAF_ESIK).
"""
import sys
from _client import build_client, ACCOUNT_ID

CID = "23998449813"
CPL_HEDEF = 400          # ₺ — üstünü "pahalı" say (turnkey yüksek değerli lead; tuning'e açık)
ISRAF_ESIK = 60          # ₺ — bu kadar harcayıp 0 dönüşüm = israf adayı
BUDGET_IS_LOST = 0.30    # bütçe kaynaklı kayıp gösterim payı > %30 = bütçe darboğazı


def L(m): return m / 1_000_000


def main():
    apply = "--apply" in sys.argv
    client = build_client(); ga = client.get_service("GoogleAdsService")
    warns = []

    # 1) Bütçe darboğazı (yükseltme ÖNERİSİ — otomatik yapılmaz)
    for r in ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT campaign.name, metrics.search_budget_lost_impression_share "
        f"FROM campaign WHERE campaign.id={CID} AND segments.date DURING LAST_7_DAYS")):
        lost = r.metrics.search_budget_lost_impression_share
        if lost and lost > BUDGET_IS_LOST:
            warns.append(f"⚠️ BÜTÇE DARBOĞAZI: gösterimin %{lost*100:.0f}'i bütçe yüzünden kaçıyor. "
                         f"Bütçe artırımı düşünülebilir (→ Asaf onayı gerekir, otomatik yapılmaz).")

    # 2) Genel CPL
    cost = conv = 0.0
    for r in ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT metrics.cost_micros, metrics.conversions FROM campaign "
        f"WHERE campaign.id={CID} AND segments.date DURING LAST_30_DAYS")):
        cost += r.metrics.cost_micros; conv += r.metrics.conversions
    if conv:
        cpl = L(cost) / conv
        if cpl > CPL_HEDEF:
            warns.append(f"⚠️ CPL yüksek: ₺{cpl:.0f} (hedef ₺{CPL_HEDEF}). Teklif/hedefleme gözden geçir.")

    # 3) 0-dönüşümlü para yakan kelimeler (son 30 gün)
    wasters = []
    for r in ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.resource_name, "
        f"metrics.cost_micros, metrics.conversions FROM keyword_view "
        f"WHERE campaign.id={CID} AND segments.date DURING LAST_30_DAYS "
        f"AND metrics.conversions = 0 AND ad_group_criterion.status = 'ENABLED'")):
        c = L(r.metrics.cost_micros)
        if c >= ISRAF_ESIK:
            wasters.append((r.ad_group.name, r.ad_group_criterion.keyword.text,
                            r.ad_group_criterion.resource_name, c))

    print("===== GUARDRAIL (son 7/30 gün) =====")
    for w in warns:
        print(w)
    if wasters:
        print(f"\n💸 İsraf adayı kelimeler (≥₺{ISRAF_ESIK}, 0 dönüşüm):")
        for ag, kw, _, c in sorted(wasters, key=lambda x: -x[3]):
            print(f"   [{ag}] \"{kw}\" → ₺{c:.0f}")
    if not warns and not wasters:
        print("✅ Sorun yok (ya da henüz yeterli veri yok).")
        return

    if wasters and apply:
        ops = []
        for _, _, rn, _ in wasters:
            op = client.get_type("AdGroupCriterionOperation")
            op.update.resource_name = rn
            op.update.status = client.enums.AdGroupCriterionStatusEnum.PAUSED
            op.update_mask.paths.append("status")
            ops.append(op)
        client.get_service("AdGroupCriterionService").mutate_ad_group_criteria(
            customer_id=ACCOUNT_ID, operations=ops)
        print(f"\n✓ {len(ops)} israf kelimesi DURAKLATILDI (harcama korundu).")
    elif wasters:
        print("\n(Uyarı modu — hiçbir şey değişmedi. Kötüleri duraklatmak için: --apply)")


if __name__ == "__main__":
    main()
