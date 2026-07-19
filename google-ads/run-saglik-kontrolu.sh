#!/bin/sh
# Google Ads sağlık kontrolü — launchd 12 saatte bir (StartInterval 43200s).
# Claude Code'u headless (-p) çağırır; SALT-OKUNUR kontrol yapar, hiçbir --apply/mutate çalıştırmaz.
WORKSPACE="/Users/asafyalcin/Downloads/PROCESSTÜRK/PROCESSTURK AI"
MODULE="$WORKSPACE/Processturk_Pazarlama_Merkezi/google-ads"
cd "$MODULE" || exit 1
NOW=$(date +%F_%H%M)
LOG="$MODULE/outputs/launchd.log"
OUT="$MODULE/outputs/saglik-${NOW}.md"
echo "=== $(date -Is) google-ads sağlık kontrolü başlıyor ===" >> "$LOG"

/usr/local/bin/claude -p "Google Ads kampanyası PT-Search-EN-Turnkey (id 23998449813, klasör Processturk_Pazarlama_Merkezi/google-ads/, çalışma dizini bu klasör) periyodik SALT-OKUNUR sağlık kontrolü — hiçbir şeyi otomatik değiştirme:

1. \`python3 scripts/rapor.py 3\` ile son 3 gün performansını çek.
2. Kampanya/reklam-grubu primary_status ve serving_status kontrol et (gerekirse _client.py ile küçük bir Python sorgusu yaz).
3. search_rank_lost_impression_share ve search_budget_lost_impression_share metriklerine bak, hangisi baskınsa teşhis et.
4. \`python3 scripts/guardrail.py\` çalıştır (--apply OLMADAN, sadece uyarı raporu).
5. \`python3 scripts/arama_terimi_negatif.py\` çalıştır (--apply OLMADAN, sadece öneri raporu).
6. Rank-lost veya budget-lost yüksekse, önerilen teklif/bütçe değerini ('CPC ₺X→₺Y önerilir, sebep: ...') yaz.
7. Kısa özet ver: genel durum iyi/kötü, varsa önerilen düzeltmeler listesi (israf kelime, negatif kelime, teklif/bütçe artışı) — hepsi ONAY BEKLER durumda, hiçbiri uygulanmaz.
8. Sorun yoksa kısaca 'sorun yok' de, uzatma.

KESİNLİKLE hiçbir --apply çalıştırma, hiçbir mutate/update işlemi yapma, hiçbir dış mesaj gönderme. Bu tamamen salt-okunur bir izleme turudur; tüm eylemler Asaf'ın onayına kalır. Çıktını TAM OLARAK şu dosyaya yaz: $OUT (başka dosya yazma)." \
  --allowedTools Bash Read Write Glob Grep >> "$LOG" 2>&1

echo "=== $(date -Is) google-ads sağlık kontrolü bitti (exit $?) — çıktı: $OUT ===" >> "$LOG"
