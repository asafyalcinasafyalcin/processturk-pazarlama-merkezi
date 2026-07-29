#!/bin/bash
# =============================================================================
# Reklam ROAS ölçümü — Pipely'deki kabul edilmiş deal'leri Meta Conversions
# API'ye (Offline Events) haftalık geri besler. TEK BETİK, VPS'te cron'dan koşulur.
#
# GÜVENLİK SINIRLARI (değiştirme):
#   · Varsayılan KURU ÇALIŞMA — capi_satis_gonder.py --apply OLMADAN koşar.
#     Gerçekten Meta'ya göndermek için CAPI_APPLY=1 ortam değişkeni AÇIKÇA verilmeli.
#   · crm.db'den yalnız OKUR (docker cp ile geçici kopya), Pipely veritabanına YAZMAZ.
#   · Kişisel veri (telefon/e-posta) yalnız SHA-256 hash olarak Meta'ya gider
#     (bkz capi_satis_gonder.py). Bu betik ham veriyi diskte yalnız geçici,
#     0600 izinli bir klasörde tutar ve iş bitince SİLER (host'ta VE konteynerde).
#
# İKİ AŞAMALI ÇALIŞMA (VPS topolojisi gereği — 2026-07-29 doğrulandı):
#   1) HOST'ta çalışır: docker cp ile Pipely DB'sini okur, CSV üretir. Sır GEREKMEZ
#      (yalnız stdlib sqlite3). Host'ta META_ACCESS_TOKEN YOK — orada tutulmuyor.
#   2) CSV, processturk-pazarlama KONTEYNERİNE kopyalanır ve capi_satis_gonder.py
#      ORADA çalıştırılır — Meta sırları yalnız konteynerin --env-file'ında yaşıyor
#      (host'a asla yazılmaz, iki kopya sır YOK).
#
# ÖN KOŞUL (Asaf, bir kere): processturk-pazarlama konteynerinin env'inde
# META_ACCESS_TOKEN + META_DATASET_ID dolu olmalı (--env-file .env.production).
# İLK ÇALIŞTIRMA: CAPI_APPLY=1 vermeden koş, raporu oku, sonra birlikte karar ver.
#
# Kullanım (VPS'te, root):
#   ./capi_haftalik.sh                    # KURU — hiçbir şey Meta'ya gitmez
#   CAPI_APPLY=1 ./capi_haftalik.sh        # GERÇEK gönderim (Asaf onayıyla)
#
# Çıktı : reklam/outputs/capi/rapor-<YYYY-AA-GG>.log
# =============================================================================
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REKLAM_DIR="$(dirname "$SCRIPTS_DIR")"
OUT_DIR="$REKLAM_DIR/outputs/capi"
mkdir -p "$OUT_DIR"
TARIH="$(date +%F)"
RAPOR="$OUT_DIR/rapor-${TARIH}.log"

PIPELY_CONTAINER="${PIPELY_CONTAINER:-paandaa-pipely}"
PAZARLAMA_CONTAINER="${PAZARLAMA_CONTAINER:-processturk-pazarlama}"
GECICI_DIR="$(mktemp -d)"
chmod 700 "$GECICI_DIR"
trap 'rm -rf "$GECICI_DIR"; docker exec "$PAZARLAMA_CONTAINER" rm -f /app/reklam/_capi_gecici.csv 2>/dev/null || true' EXIT

echo "=== capi_haftalik.sh $TARIH ===" | tee "$RAPOR"

# 1) Pipely DB'sinin salt-okunur bir kopyasını çek (WAL modu → -wal/-shm de gerekli).
for ext in "" "-wal" "-shm"; do
  docker cp "${PIPELY_CONTAINER}:/app/data/crm.db${ext}" "$GECICI_DIR/crm.db${ext}" 2>/dev/null || true
done
if [ ! -f "$GECICI_DIR/crm.db" ]; then
  echo "HATA: crm.db kopyalanamadı (konteyner adı doğru mu: $PIPELY_CONTAINER)" | tee -a "$RAPOR" >&2
  exit 1
fi

# 2) Won deal'leri CSV'ye çıkar (yalnız son 30 gün, tekrar taramayı sınırlar). Sır gerekmez.
SONRA="$(date -d "-30 days" +%F 2>/dev/null || date -v-30d +%F 2>/dev/null || echo "")"
CSV="$GECICI_DIR/satislar.csv"
python3 "$SCRIPTS_DIR/pipely_satis_cek.py" \
  --db "$GECICI_DIR/crm.db" --sonra "$SONRA" --cikti "$CSV" 2>&1 | tee -a "$RAPOR"

SATIR_SAYISI="$(($(wc -l < "$CSV") - 1))"
if [ "$SATIR_SAYISI" -le 0 ]; then
  echo "Gönderilecek yeni satış yok, bitti." | tee -a "$RAPOR"
  exit 0
fi

# 3) CSV'yi sırların yaşadığı konteynere taşı, gönderimi ORADA çalıştır.
APPLY_FLAG=""
if [ "${CAPI_APPLY:-0}" = "1" ]; then
  APPLY_FLAG="--apply"
  echo "⚠️ CAPI_APPLY=1 — GERÇEK gönderim yapılacak." | tee -a "$RAPOR"
else
  echo "KURU ÇALIŞMA (varsayılan) — hiçbir şey Meta'ya gönderilmeyecek." | tee -a "$RAPOR"
fi

docker cp "$CSV" "${PAZARLAMA_CONTAINER}:/app/reklam/_capi_gecici.csv"
docker exec -w /app/reklam "$PAZARLAMA_CONTAINER" \
  python3 scripts/capi_satis_gonder.py --girdi _capi_gecici.csv $APPLY_FLAG 2>&1 | tee -a "$RAPOR"

echo "=== bitti → $RAPOR ===" | tee -a "$RAPOR"
