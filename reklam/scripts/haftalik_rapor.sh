#!/bin/bash
# =============================================================================
# Haftalık reklam raporu — Meta + Google Ads, TEK BETİK, SALT ÖNERİ.
#
# Neden var: raporlama/guardrail elle koşuluyordu ve unutuluyordu (bir kampanya
# bütçe düşürme planı unutulup kapatıldı). Bu betik doğrudan cron'dan çağrılır.
#
# ⛔ `claude -p` KULLANILMAZ: arka planda "Not logged in" verir (Keychain/OAuth
#    erişilemiyor) — bkz google-ads/README.md, launchd denemesi 2026-07-09'da
#    terk edildi. Script'ler doğrudan python3 ile koşulur.
#
# GÜVENLİK SINIRLARI (değiştirme):
#   · Hepsi SALT-OKUNUR / SALT-ÖNERİ. Hiçbir --apply / mutate çağrısı YOK.
#   · Bütçe artırımı ASLA otomatik yapılmaz; guardrail yalnız azaltır ve burada
#     --apply'sız (yalnız uyarı modunda) çalışır.
#   · Reklam yayınlamaz, durdurmaz, dış mesaj göndermez.
#
# Kullanım:
#   ./haftalik_rapor.sh              # varsayılan: Meta son 7 gün, Google son 7 gün
#   ./haftalik_rapor.sh 14           # her iki tarafta da 14 günlük pencere
#
# Çıktı : reklam/outputs/haftalik/rapor-<YYYY-AA-GG>.md
# Log   : reklam/outputs/haftalik/haftalik_rapor.log  (her koşu eklenir)
# Çıkış : 0 = hepsi başarılı · 1 = en az bir adım hata verdi (cron hatayı görsün)
# =============================================================================
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REKLAM_DIR="$(dirname "$SCRIPTS_DIR")"                 # .../reklam
MERKEZ_DIR="$(dirname "$REKLAM_DIR")"                  # .../Processturk_Pazarlama_Merkezi
GOOGLE_ADS_DIR="$MERKEZ_DIR/google-ads"

GUN="${1:-7}"
case "$GUN" in ''|*[!0-9]*) echo "HATA: gün sayısı tam sayı olmalı (verilen: '$GUN')" >&2; exit 2;; esac

OUT_DIR="$REKLAM_DIR/outputs/haftalik"
mkdir -p "$OUT_DIR"
TARIH="$(date +%F)"
RAPOR="$OUT_DIR/rapor-${TARIH}.md"
LOG="$OUT_DIR/haftalik_rapor.log"

PY="${PYTHON_BIN:-python3}"
HATA_SAYISI=0
BASARISIZ_ADIMLAR=""

# NOT: `date -Is` BSD/macOS date'te YOK (GNU'ya özgü) → taşınabilir biçim kullanılır.
log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] $*" >> "$LOG"; }

# Bir adımı koşar: başlığı rapora yazar, çıktıyı rapora gömer, hatayı YUTMAZ
# (rapora ❌ + hata çıktısı yazar, sayaç artar, betik sonunda exit 1 olur).
adim() {
  local baslik="$1"; shift
  local calisma_dizini="$1"; shift
  local gecici; gecici="$(mktemp)"
  local rc=0

  log "ADIM BAŞLADI: $baslik → $*"
  {
    echo ""
    echo "## $baslik"
    echo ""
    echo '```'
  } >> "$RAPOR"

  # set -e bu alt kabuğu öldürmesin diye || ile yakalanır; çıktı hem rapora hem log'a gider.
  ( cd "$calisma_dizini" && "$@" ) > "$gecici" 2>&1 || rc=$?

  cat "$gecici" >> "$RAPOR"
  echo '```' >> "$RAPOR"

  if [ "$rc" -ne 0 ]; then
    HATA_SAYISI=$((HATA_SAYISI + 1))
    BASARISIZ_ADIMLAR="${BASARISIZ_ADIMLAR}\n  - ${baslik} (çıkış kodu ${rc})"
    echo "" >> "$RAPOR"
    echo "> ❌ **BU ADIM HATA VERDİ** (çıkış kodu \`${rc}\`) — yukarıdaki çıktıya bak." >> "$RAPOR"
    log "ADIM HATA: $baslik (rc=$rc)"
    cat "$gecici" >> "$LOG"
  else
    log "ADIM TAMAM: $baslik"
  fi

  rm -f "$gecici"
  return 0
}

# --- Rapor başlığı -----------------------------------------------------------
cat > "$RAPOR" <<EOF
# Haftalık Reklam Raporu — $TARIH

- Pencere: son **$GUN gün**
- Üretim: \`reklam/scripts/haftalik_rapor.sh\` (cron, otomatik)
- Mod: **SALT OKUNUR / SALT ÖNERİ** — hiçbir bütçe, teklif, kelime veya kampanya
  durumu DEĞİŞTİRİLMEDİ. Guardrail \`--apply\` olmadan koştu (yalnız uyarı).
- Karar gerektiren her madde **Asaf'ın onayını bekler**. Bütçe artırımı asla otomatik değildir.
EOF

log "=== haftalik_rapor.sh başladı (pencere=${GUN}g, rapor=$RAPOR) ==="

# --- 1) Meta (Facebook/Instagram) Insights — salt-okunur ---------------------
# Meta yalnız sabit preset'leri kabul eder (last_7d/last_30d…), keyfi gün sayısını etmez →
# pencereyi --since/--until ile açıkça veriyoruz (her gün sayısı için çalışır).
# SINCE hesabı betiği düşürmesin (set -e): macOS `date -v`, sonra GNU `date -d`, sonra python.
UNTIL="$TARIH"
SINCE="$(date -v-"${GUN}"d +%F 2>/dev/null \
      || date -d "-${GUN} days" +%F 2>/dev/null \
      || "$PY" -c "import datetime,sys; print(datetime.date.today()-datetime.timedelta(days=int(sys.argv[1])))" "$GUN" 2>/dev/null \
      || echo "")"
if [ -z "$SINCE" ]; then
  echo "HATA: başlangıç tarihi hesaplanamadı (date/python3 yok?)" >&2
  log "KRİTİK: SINCE hesaplanamadı"
  exit 2
fi

adim "Meta Insights — CPL / konsept özeti (salt-okunur, $SINCE → $UNTIL)" \
     "$REKLAM_DIR" \
     "$PY" "$SCRIPTS_DIR/meta_report.py" --since "$SINCE" --until "$UNTIL"

# --- 2) Google Ads performans raporu — salt-okunur ---------------------------
adim "Google Ads — performans raporu (salt-okunur)" \
     "$GOOGLE_ADS_DIR" \
     "$PY" "scripts/rapor.py" "$GUN"

# --- 3) Google Ads guardrail — SALT UYARI (--apply YOK, bilinçli) ------------
# DİKKAT: buraya --apply EKLENMEZ. Guardrail yalnız azaltır ve o bile elle onaylanır.
adim "Google Ads — guardrail (SALT ÖNERİ, --apply YOK)" \
     "$GOOGLE_ADS_DIR" \
     "$PY" "scripts/guardrail.py"

# --- Kapanış ------------------------------------------------------------------
{
  echo ""
  echo "---"
  echo ""
  echo "## Özet"
  echo ""
  if [ "$HATA_SAYISI" -eq 0 ]; then
    echo "✅ 3 adımın hepsi başarıyla koştu."
  else
    echo "❌ **$HATA_SAYISI adım hata verdi:**"
    printf "%b\n" "$BASARISIZ_ADIMLAR"
  fi
  echo ""
  echo "### Sıradaki adım (elle)"
  echo "- Yukarıdaki guardrail uyarılarını incele."
  echo "- Kelime duraklatma gerekiyorsa (harcamayı AZALTIR): \`cd google-ads && python3 scripts/guardrail.py --apply\`"
  echo "- Bütçe artışı gerekiyorsa: **otomatik yapılmaz**, Asaf'ın açık onayıyla \`scripts/butce_guncelle.py\`."
  echo ""
  echo "_Bu rapor otomatik üretildi; hiçbir reklam ayarı değiştirilmedi._"
} >> "$RAPOR"

log "=== bitti (hata=$HATA_SAYISI) → $RAPOR ==="
echo "Rapor hazır: $RAPOR"

if [ "$HATA_SAYISI" -ne 0 ]; then
  echo "UYARI: $HATA_SAYISI adım hata verdi — ayrıntı raporda ve $LOG içinde." >&2
  exit 1
fi
exit 0
