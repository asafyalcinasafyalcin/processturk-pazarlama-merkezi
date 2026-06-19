#!/usr/bin/env bash
# ProcessTürk Pazarlama Komuta Merkezi — lokal başlatıcı (port 4181)
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "→ Bağımlılıklar kuruluyor (npm install)…"
  npm install
fi

if [ ! -f .env.local ]; then
  echo "⚠ .env.local yok. .env.example'dan kopyalanıyor — FAL_KEY'i doldurmayı unutma."
  cp .env.example .env.local
fi

MODE="${1:-dev}"
if [ "$MODE" = "prod" ]; then
  echo "→ Production build + start (http://127.0.0.1:4181)"
  npm run build
  npm run start
else
  echo "→ Dev server (http://127.0.0.1:4181)"
  npm run dev
fi
