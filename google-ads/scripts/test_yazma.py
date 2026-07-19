#!/usr/bin/env python3
"""
Yazma izni testi — Explorer erişimiyle kampanya OLUŞTURABİLİYOR muyuz?
validate_only=True → HİÇBİR ŞEY oluşturmaz, sadece Google'a doğrulatır.
"""
import sys
from _client import build_client, ACCOUNT_ID


def main():
    client = build_client()
    svc = client.get_service("CampaignBudgetService")
    op = client.get_type("CampaignBudgetOperation")
    b = op.create
    b.name = "PT-write-access-check"
    b.amount_micros = 100_000_000  # ₺100
    b.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
    req = client.get_type("MutateCampaignBudgetsRequest")
    req.customer_id = ACCOUNT_ID
    req.operations = [op]
    req.validate_only = True
    try:
        svc.mutate_campaign_budgets(request=req)
        print("✅ YAZMA İZNİ VAR — Explorer erişimiyle kampanya kurabilirim (validate_only geçti).")
    except Exception as e:
        msg = str(e)
        if "DEVELOPER_TOKEN" in msg or "access" in msg.lower() or "PERMISSION" in msg:
            print("⚠️ YAZMA ENGELLİ — muhtemelen Basic access gerekiyor. API Center'dan başvuralım.")
        print("\n--- Ham hata ---\n" + msg[:1500])
        sys.exit(1)


if __name__ == "__main__":
    main()
