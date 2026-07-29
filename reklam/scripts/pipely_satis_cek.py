#!/usr/bin/env python3
"""
Pipely (Sales Core) → capi_satis_gonder.py girdi CSV'si.

NEDEN VAR: capi_satis_gonder.py'nin kaynağı (--girdi) elle hazırlanmış bir CSV/JSON
bekliyordu; bu script o CSV'yi Pipely'nin canlı SQLite veritabanından (kabul edilmiş/
"won" deal'ler) otomatik üretir — elle Excel hazırlama halkasını kapatır.

KAYNAK ŞEMA (paandaa-pipely, prisma/schema.prisma — 2026-07-29 okundu):
  Deal(id, tenantId, stage, value, contactId, sourceId, closeDate, updatedAt, ...)
  Contact(id, tenantId, email, phone, ...)
  QuoteRevision(dealId, amount, currency, ...) — Deal'de para birimi YOK, en güncel
  teklif revizyonundan alınır (yoksa para_birimi boş kalır, satır capi tarafında atlanır).

⚠️ ctwa_clid Pipely'nin Deal/Contact modelinde YOK (Paandaa chatbot'un kendi
conversations tablosunda tutuluyor, ayrı sistem — bkz [[project_reklam_olcum_claude_ads]]).
Bu yüzden eşleştirme yalnız telefon/e-posta hash'iyle yapılır (Meta Advantage matching);
ctwa_clid köprüsü ayrı bir iş paketi (chathub conversations ↔ Pipely Deal join).

ÇALIŞMA MODU: SALT-OKUNUR. crm.db'ye YAZMAZ. WAL modundaki DB'yi doğrudan okumak için
önce bağlantıyı salt-okunur açar (sqlite3 "mode=ro" URI) — capi script'i gibi bu da
varsayılan olarak zararsızdır (yalnız CSV üretir, hiçbir şeyi Meta'ya GÖNDERMEZ).

KULLANIM (yerel test — sahte DB):
  python3 pipely_satis_cek.py --db /tmp/ornek.db --cikti /tmp/satislar.csv

KULLANIM (canlı — VPS'te crm.db'nin yanında çalıştırılır, ör. docker cp sonrası):
  python3 pipely_satis_cek.py --db crm.db --tenant default \
      --sonra 2026-07-01 --cikti satislar.csv
  # ardından:
  python3 capi_satis_gonder.py --girdi satislar.csv                       # KURU önce bak
  python3 capi_satis_gonder.py --girdi satislar.csv --apply               # gerçek gönderim

Üretilen CSV sütunları capi_satis_gonder.py'nin beklediği ile BİREBİR aynı:
  lead_id, olay_zamani, deger, para_birimi, telefon, eposta, ref, olay_adi
(ctwa_clid ve izin sütunları bilinçli olarak yok — yukarıdaki notlara bak.)
"""
import argparse
import csv
import sqlite3
import sys
from pathlib import Path


WON_STAGES = {"won", "kazanildi", "kabul edildi", "kabul_edildi"}


def _connect_ro(db_path: Path) -> sqlite3.Connection:
    if not db_path.exists():
        sys.exit(f"DB bulunamadı: {db_path}")
    uri = f"file:{db_path.as_posix()}?mode=ro"
    return sqlite3.connect(uri, uri=True)


def _latest_quote_currency(conn: sqlite3.Connection, deal_id: str):
    row = conn.execute(
        "SELECT amount, currency FROM QuoteRevision WHERE dealId = ? "
        "ORDER BY createdAt DESC LIMIT 1",
        (deal_id,),
    ).fetchone()
    return row if row else (None, None)


def cek(db_path: Path, tenant: str, sonra: str, ref: str, olay_adi: str) -> list:
    conn = _connect_ro(db_path)
    conn.row_factory = sqlite3.Row
    q = (
        "SELECT d.id AS deal_id, d.value AS deal_value, d.updatedAt AS updated_at, "
        "d.closeDate AS close_date, d.stage AS stage, d.company AS company, "
        "c.email AS email, c.phone AS phone "
        "FROM Deal d LEFT JOIN Contact c ON c.id = d.contactId "
        "WHERE d.tenantId = ?"
    )
    params = [tenant]
    if sonra:
        q += " AND d.updatedAt >= ?"
        params.append(sonra)
    rows = conn.execute(q, params).fetchall()

    satirlar = []
    atlanan = []
    for r in rows:
        if str(r["stage"] or "").strip().lower() not in WON_STAGES:
            continue
        amount, currency = _latest_quote_currency(conn, r["deal_id"])
        deger = amount if amount is not None else r["deal_value"]
        para = currency  # Deal.value'da birim yok — yalnız QuoteRevision'dan gelir
        if not para:
            atlanan.append((r["deal_id"], "para_birimi bulunamadı (QuoteRevision yok)"))
            continue
        if not r["email"] and not r["phone"]:
            atlanan.append((r["deal_id"], "telefon/e-posta yok (eşleştirme imkansız)"))
            continue
        satirlar.append({
            "lead_id": r["deal_id"],
            "olay_zamani": (r["close_date"] or r["updated_at"] or ""),
            "deger": deger,
            "para_birimi": para,
            "telefon": r["phone"] or "",
            "eposta": r["email"] or "",
            "ref": ref,
            "olay_adi": olay_adi,
        })
    conn.close()
    if atlanan:
        print(f"[pipely_satis_cek] {len(atlanan)} deal atlandı:", file=sys.stderr)
        for did, sebep in atlanan:
            print(f"  - {did}: {sebep}", file=sys.stderr)
    return satirlar


def main():
    ap = argparse.ArgumentParser(description="Pipely won-deal → capi_satis_gonder.py CSV'si")
    ap.add_argument("--db", required=True, help="crm.db yolu (salt-okunur açılır)")
    ap.add_argument("--tenant", default="default")
    ap.add_argument("--sonra", default="", help="ISO tarih — yalnız bu tarihten sonra güncellenen deal'ler")
    ap.add_argument("--ref", default="", help="Tüm satırlara yazılacak atıf etiketi (opsiyonel)")
    ap.add_argument("--olay-adi", default="Purchase")
    ap.add_argument("--cikti", required=True, help="Yazılacak CSV yolu")
    a = ap.parse_args()

    satirlar = cek(Path(a.db), a.tenant, a.sonra, a.ref, a.olay_adi)
    if not satirlar:
        print("Gönderilecek yeni satış bulunamadı (0 satır).", file=sys.stderr)

    out = Path(a.cikti)
    with out.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["lead_id", "olay_zamani", "deger", "para_birimi", "telefon", "eposta", "ref", "olay_adi"])
        w.writeheader()
        w.writerows(satirlar)
    print(f"{len(satirlar)} satır yazıldı: {out}")


if __name__ == "__main__":
    main()
