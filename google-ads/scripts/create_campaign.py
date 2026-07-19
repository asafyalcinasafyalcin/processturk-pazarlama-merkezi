#!/usr/bin/env python3
"""
JENERİK Search kampanya kurucusu — bir campaign.json'dan kampanyayı PAUSED oluşturur.
Marka-bağımsız: hesap .env'den, kampanya tanımı JSON'dan gelir.

Kullanım:
  python3 create_campaign.py [campaign.json]              # kur (PAUSED)
  python3 create_campaign.py campaign.json --dry           # yerel doğrulama, HİÇBİR Ads API çağrısı YOK
  python3 create_campaign.py campaign.json --validate-only # Google'a validate_only=True ile sorar (yazmaz)
  python3 create_campaign.py campaign.json --reset         # aynı adlı kampanyayı kaldırıp yeniden kur

GÖMÜLÜ KURALLAR (hepsi kanıtlanmış ders — SKILL.md "Tuzaklar"):
  • Tüm Final URL'ler AdsBot'a 200 dönmeden kurulmaz (url_kontrol).
  • RSA: başlık ≤30 krk & ≤15 adet, açıklama ≤90 krk & ≤4 adet, path1/path2 ≤15 krk — ihlalde durur.
  • `contains_eu_political_advertising` ZORUNLU alandır — her kampanyada set edilir.
  • Manual CPC (Maximize Clicks/TargetSpend deprecate ediliyor).
  • Kampanya PAUSED kurulur; yayına alma AYRI adımdır (kampanya_durum.py <id> ENABLED).
  • `validate_only` bir kwarg DEĞİL, request nesnesinin alanıdır (bkz. _mutate).

CONFIG ŞEMASI (bkz. campaign.example.json):
  name, daily_budget_try, default_cpc_try, search_partners
  language_id VEYA language_ids: [1000, 1002]      ← çok dilli kampanya
  geo_target_ids: [2566, ...]
  start_date_time / end_date_time  VEYA  duration_days   ← süreli (gezi/sezon) kampanya
  final_url / path1 / path2 / headlines / descriptions   ← kampanya düzeyi VARSAYILAN
  negatives: [...]
  ad_groups: [{ name, final_url?, path1?, path2?, cpc_try?, keywords, headlines?, descriptions? }]
  Reklam grubu alan vermezse kampanya düzeyi varsayılanı miras alır.
"""
import sys, json
from datetime import datetime, timedelta
from _client import build_client, ACCOUNT_ID
from url_kontrol import check_urls

MAX_HEADLINES = 15
MAX_DESCRIPTIONS = 4


# ---------------------------------------------------------------- config

def load_cfg(path):
    with open(path) as f:
        return json.load(f)


def resolve(cfg):
    """Reklam gruplarına kampanya düzeyi varsayılanları miras ettirir (yerinde normalize eder)."""
    for ag in cfg["ad_groups"]:
        for field in ("final_url", "path1", "path2", "headlines", "descriptions"):
            if field not in ag and field in cfg:
                ag[field] = cfg[field]
        ag.setdefault("path1", "")
        ag.setdefault("path2", "")
    return cfg


def languages(cfg):
    """language_ids (çoklu) veya language_id (tekli) — ikisi de desteklenir."""
    if cfg.get("language_ids"):
        return list(cfg["language_ids"])
    if cfg.get("language_id"):
        return [cfg["language_id"]]
    return []


def schedule(cfg):
    """(start_date_time, end_date_time) veya (None, None). duration_days = bugünden N gün."""
    start = cfg.get("start_date_time")
    end = cfg.get("end_date_time")
    if not start and not end and cfg.get("duration_days"):
        today = datetime.now()
        start = today.strftime("%Y-%m-%d 00:00:00")
        end = (today + timedelta(days=int(cfg["duration_days"]) - 1)).strftime("%Y-%m-%d 23:59:59")
    return start, end


# ---------------------------------------------------------------- doğrulama

def validate(cfg):
    errs = []
    if not cfg.get("name"):
        errs.append("kampanya 'name' zorunlu")
    if not cfg.get("geo_target_ids"):
        errs.append("'geo_target_ids' boş olamaz")
    if not languages(cfg):
        errs.append("'language_id' veya 'language_ids' zorunlu")
    if not cfg.get("daily_budget_try"):
        errs.append("'daily_budget_try' zorunlu")

    seen = set()
    for ag in cfg["ad_groups"]:
        tag = ag.get("name", "?")
        if tag in seen:
            errs.append(f"[{tag}] reklam grubu adı mükerrer")
        seen.add(tag)

        if not ag.get("final_url"):
            errs.append(f"[{tag}] final_url yok (grup düzeyinde ya da kampanya düzeyinde ver)")
        if not ag.get("keywords"):
            errs.append(f"[{tag}] keywords boş")

        heads = ag.get("headlines", [])
        descs = ag.get("descriptions", [])
        for h in heads:
            if len(h) > 30:
                errs.append(f"[{tag}] başlık >30: '{h}' ({len(h)})")
        for d in descs:
            if len(d) > 90:
                errs.append(f"[{tag}] açıklama >90: '{d}' ({len(d)})")
        if len(heads) < 3:
            errs.append(f"[{tag}] en az 3 başlık gerekir ({len(heads)})")
        if len(heads) > MAX_HEADLINES:
            errs.append(f"[{tag}] en çok {MAX_HEADLINES} başlık ({len(heads)}) — Google reddeder")
        if len(descs) < 2:
            errs.append(f"[{tag}] en az 2 açıklama gerekir ({len(descs)})")
        if len(descs) > MAX_DESCRIPTIONS:
            errs.append(f"[{tag}] en çok {MAX_DESCRIPTIONS} açıklama ({len(descs)}) — Google reddeder")
        for p in (ag.get("path1", ""), ag.get("path2", "")):
            if len(p) > 15:
                errs.append(f"[{tag}] path >15: '{p}' ({len(p)})")
        for kw in ag.get("keywords", []):
            if not (isinstance(kw, (list, tuple)) and len(kw) == 2):
                errs.append(f"[{tag}] anahtar kelime [metin, EŞLEŞME] biçiminde olmalı: {kw!r}")
            elif kw[1] not in ("EXACT", "PHRASE", "BROAD"):
                errs.append(f"[{tag}] geçersiz eşleşme türü '{kw[1]}' (EXACT|PHRASE|BROAD)")
    return errs


# ---------------------------------------------------------------- API yardımcısı

def _mutate(client, service_name, method_name, request_type, ops, validate_only):
    """
    TUZAK: `validate_only` bir kwarg DEĞİL — request nesnesinin ALANIDIR.
    Bu yüzden her mutasyon request nesnesi üzerinden gider.
    validate_only=True iken Google hiçbir şey YAZMAZ, yalnız doğrular (resource_name dönmez).
    """
    req = client.get_type(request_type)
    req.customer_id = ACCOUNT_ID
    req.operations.extend(ops)
    req.validate_only = validate_only
    return getattr(client.get_service(service_name), method_name)(request=req)


# ---------------------------------------------------------------- ana akış

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    cfg_path = args[0] if args else "campaign.json"
    dry = "--dry" in sys.argv
    validate_only = "--validate-only" in sys.argv
    reset = "--reset" in sys.argv

    cfg = resolve(load_cfg(cfg_path))
    start_dt, end_dt = schedule(cfg)
    lang_ids = languages(cfg)

    # 1) Yerel doğrulama (RSA limitleri, şema) — API'ye dokunmaz
    errs = validate(cfg)
    if errs:
        print("⛔ Config doğrulama hataları:")
        [print("  -", e) for e in errs]
        sys.exit(1)

    # 2) ZORUNLU URL kontrolü (AdsBot 200) — Ads API değil, hedef siteye HTTP GET
    urls = [ag["final_url"] for ag in cfg["ad_groups"]]
    ok, rep = check_urls(urls)
    for u, (o, res) in rep.items():
        print(f"  {'✅' if o else '❌'} {u}  {res}")
    if not ok:
        sys.exit("⛔ Bir Final URL AdsBot'a 200 dönmüyor — KURULMADI. Önce düzelt.")

    nkw = sum(len(a["keywords"]) for a in cfg["ad_groups"])
    ozet = (f"{cfg['name']}: {len(cfg['ad_groups'])} grup · {nkw} kelime · "
            f"{len(cfg.get('negatives', []))} negatif · {len(cfg['geo_target_ids'])} konum · "
            f"dil {lang_ids} · ₺{cfg['daily_budget_try']}/gün · CPC ₺{cfg.get('default_cpc_try', 5)}")
    if start_dt:
        ozet += f" · {start_dt} → {end_dt}"

    if dry:
        # --dry: buradan sonrası hiç çalışmaz → build_client() çağrılmaz, TEK BİR Ads API isteği gitmez.
        print(f"\n[DRY] {ozet}")
        print("[DRY] Hiçbir Google Ads API çağrısı yapılmadı. Kurmak için --dry'sız çalıştır.")
        return

    client = build_client()
    ga = client.get_service("GoogleAdsService")
    NAME = cfg["name"]
    enums = client.enums

    if validate_only:
        print(f"\n[VALIDATE-ONLY] {ozet}")
        print("[VALIDATE-ONLY] Google'a validate_only=True ile sorulacak — hiçbir kayıt YAZILMAZ.")

    # Mükerrer kurulum koruması
    exists = list(ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT campaign.resource_name FROM campaign WHERE campaign.name = '{NAME}' "
        f"AND campaign.status != 'REMOVED'")))
    if exists:
        if reset and not validate_only:
            op = client.get_type("CampaignOperation")
            op.remove = exists[0].campaign.resource_name
            _mutate(client, "CampaignService", "mutate_campaigns",
                    "MutateCampaignsRequest", [op], False)
            print("↺ Mevcut kampanya kaldırıldı (--reset)")
        elif not validate_only:
            sys.exit(f"⛔ '{NAME}' zaten var. Yeniden kurmak için: --reset")

    # --- Bütçe (varsa yeniden kullan → orphan bütçe birikmez)
    bname = f"{NAME} Budget"
    eb = list(ga.search(customer_id=ACCOUNT_ID, query=(
        f"SELECT campaign_budget.resource_name FROM campaign_budget "
        f"WHERE campaign_budget.name = '{bname}' LIMIT 1")))
    bop = client.get_type("CampaignBudgetOperation")
    bop.create.name = bname
    bop.create.amount_micros = int(cfg["daily_budget_try"] * 1_000_000)
    bop.create.delivery_method = enums.BudgetDeliveryMethodEnum.STANDARD
    bop.create.explicitly_shared = False
    if eb and not validate_only:
        budget_rn = eb[0].campaign_budget.resource_name
        print("✓ Mevcut bütçe yeniden kullanıldı")
    else:
        res = _mutate(client, "CampaignBudgetService", "mutate_campaign_budgets",
                      "MutateCampaignBudgetsRequest", [bop], validate_only)
        budget_rn = None if validate_only else res.results[0].resource_name
        print("✓ Bütçe" + (" (doğrulandı)" if validate_only else " oluşturuldu"))

    # --- Kampanya
    cop = client.get_type("CampaignOperation")
    c = cop.create
    c.name = NAME
    c.advertising_channel_type = enums.AdvertisingChannelTypeEnum.SEARCH
    c.status = enums.CampaignStatusEnum.PAUSED          # her zaman PAUSED doğar
    c.campaign_budget = budget_rn or "customers/0/campaignBudgets/0"
    # ZORUNLU alan — set edilmezse kampanya oluşturma reddedilir
    c.contains_eu_political_advertising = (
        enums.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING)
    c.manual_cpc = client.get_type("ManualCpc")
    if start_dt:
        c.start_date_time = start_dt
    if end_dt:
        c.end_date_time = end_dt
    c.network_settings.target_google_search = True
    c.network_settings.target_search_network = bool(cfg.get("search_partners", False))
    c.network_settings.target_content_network = False
    c.network_settings.target_partner_search_network = False

    if validate_only:
        print("✓ Kampanya alanları doğrulandı (bütçe/kampanya dışındaki adımlar gerçek "
              "parent resource gerektirir → yerel doğrulamayla yetinildi)")
        print("\n✅ VALIDATE-ONLY tamamlandı — hesapta hiçbir değişiklik yapılmadı.")
        return

    camp_rn = _mutate(client, "CampaignService", "mutate_campaigns",
                      "MutateCampaignsRequest", [cop], False).results[0].resource_name
    campaign_id = camp_rn.split("/")[-1]
    print(f"✓ Kampanya (PAUSED) — id {campaign_id}"
          + (f" · {start_dt} → {end_dt}" if start_dt else ""))

    # --- Kriterler: geo + dil(ler) + negatifler
    ccops = []
    for gid in cfg["geo_target_ids"]:
        op = client.get_type("CampaignCriterionOperation")
        op.create.campaign = camp_rn
        op.create.location.geo_target_constant = f"geoTargetConstants/{gid}"
        ccops.append(op)
    for lid in lang_ids:
        op = client.get_type("CampaignCriterionOperation")
        op.create.campaign = camp_rn
        op.create.language.language_constant = f"languageConstants/{lid}"
        ccops.append(op)
    for kw in dict.fromkeys(cfg.get("negatives", [])):     # tekilleştir
        op = client.get_type("CampaignCriterionOperation")
        op.create.campaign = camp_rn
        op.create.negative = True
        op.create.keyword.text = kw
        op.create.keyword.match_type = (
            enums.KeywordMatchTypeEnum.PHRASE if " " in kw else enums.KeywordMatchTypeEnum.BROAD)
        ccops.append(op)
    _mutate(client, "CampaignCriterionService", "mutate_campaign_criteria",
            "MutateCampaignCriteriaRequest", ccops, False)
    print(f"✓ {len(cfg['geo_target_ids'])} konum + {len(lang_ids)} dil + "
          f"{len(set(cfg.get('negatives', [])))} negatif")

    # --- Reklam grupları (grup düzeyi cpc_try, yoksa default_cpc_try)
    default_cpc = int(cfg.get("default_cpc_try", 5) * 1_000_000)
    agops = []
    for ag in cfg["ad_groups"]:
        op = client.get_type("AdGroupOperation")
        op.create.name = ag["name"]
        op.create.campaign = camp_rn
        op.create.type_ = enums.AdGroupTypeEnum.SEARCH_STANDARD
        op.create.cpc_bid_micros = (int(ag["cpc_try"] * 1_000_000)
                                    if ag.get("cpc_try") else default_cpc)
        op.create.status = enums.AdGroupStatusEnum.ENABLED
        agops.append(op)
    res = _mutate(client, "AdGroupService", "mutate_ad_groups",
                  "MutateAdGroupsRequest", agops, False).results
    ag_rn = {ag["name"]: r.resource_name for ag, r in zip(cfg["ad_groups"], res)}
    print(f"✓ {len(ag_rn)} reklam grubu")

    # --- Anahtar kelimeler
    kops = []
    for ag in cfg["ad_groups"]:
        for text, match in ag["keywords"]:
            op = client.get_type("AdGroupCriterionOperation")
            op.create.ad_group = ag_rn[ag["name"]]
            op.create.status = enums.AdGroupCriterionStatusEnum.ENABLED
            op.create.keyword.text = text
            op.create.keyword.match_type = getattr(enums.KeywordMatchTypeEnum, match)
            kops.append(op)
    _mutate(client, "AdGroupCriterionService", "mutate_ad_group_criteria",
            "MutateAdGroupCriteriaRequest", kops, False)
    print(f"✓ {len(kops)} anahtar kelime")

    # --- RSA'lar
    adops = []
    for ag in cfg["ad_groups"]:
        op = client.get_type("AdGroupAdOperation")
        op.create.ad_group = ag_rn[ag["name"]]
        op.create.status = enums.AdGroupAdStatusEnum.ENABLED
        op.create.ad.final_urls.append(ag["final_url"])
        rsa = op.create.ad.responsive_search_ad
        for h in ag["headlines"]:
            a = client.get_type("AdTextAsset"); a.text = h; rsa.headlines.append(a)
        for d in ag["descriptions"]:
            a = client.get_type("AdTextAsset"); a.text = d; rsa.descriptions.append(a)
        if ag.get("path1"): rsa.path1 = ag["path1"]
        if ag.get("path2"): rsa.path2 = ag["path2"]
        adops.append(op)
    _mutate(client, "AdGroupAdService", "mutate_ad_group_ads",
            "MutateAdGroupAdsRequest", adops, False)
    print(f"✓ {len(adops)} responsive search ad")

    print(f"\n🎯 KURULDU — DURUM: PAUSED (harcama yok, yayın sahibin onayına bağlı)")
    print(f"   Yayına almak için: python3 kampanya_durum.py {campaign_id} ENABLED")
    if cfg.get("hatirlatma"):
        print(f"   ⏰ HATIRLATMA: {cfg['hatirlatma'].replace('<id>', campaign_id)}")


if __name__ == "__main__":
    main()
