#!/bin/sh
# ProcessTürk Pazarlama Merkezi — container başlangıcı.
# Higgsfield CLI auth'unu env'den ($HF_CREDENTIALS_JSON) bir kez tohumlar; sonra
# CLI token'ı kendisi yeniler ve diske yazar. Bu yüzden $HOME/.config/higgsfield
# KALICI STORAGE'a (Coolify) mount edilmeli — yoksa her redeploy'da refresh token
# tükenmiş olabilir. Dosya zaten varsa ELLEMEZ (kalıcı/yenilenmiş token'ı korur).
set -e

CONF_DIR="$HOME/.config/higgsfield"
mkdir -p "$CONF_DIR"

if [ ! -s "$CONF_DIR/credentials.json" ] && [ -n "$HF_CREDENTIALS_JSON" ]; then
  printf '%s' "$HF_CREDENTIALS_JSON" > "$CONF_DIR/credentials.json"
  chmod 600 "$CONF_DIR/credentials.json"
  echo "[entrypoint] Higgsfield credentials env'den tohumlandı."
elif [ -s "$CONF_DIR/credentials.json" ]; then
  echo "[entrypoint] Higgsfield credentials mevcut (kalıcı storage)."
else
  echo "[entrypoint] UYARI: Higgsfield credentials yok — görsel/video/ses üretimi çalışmaz. HF_CREDENTIALS_JSON env'ini ekle."
fi

exec node server.js
