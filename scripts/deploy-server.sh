#!/usr/bin/env sh
# ProcessTürk Pazarlama Komuta Merkezi — VPS yayın scripti (Docker + Traefik + Let's Encrypt).
# Coolify ağında çalışır; panel dışarıdan https://$APP_DOMAIN (basic auth) erişilir.
# İKİ kalıcı mount: /app/data (panel state) + /app/.hfhome (Higgsfield CLI auth/token).
set -eu

APP_NAME="${APP_NAME:-processturk-pazarlama}"
APP_DOMAIN="${APP_DOMAIN:-pazarlama.72.60.134.242.nip.io}"
IMAGE_NAME="${APP_NAME}:latest"
OLD_NAME="${APP_NAME}-previous"
ENV_FILE=".env.production"
DATA_DIR="${DATA_DIR:-/opt/processturk-pazarlama/data}"
HFHOME_DIR="${HFHOME_DIR:-/opt/processturk-pazarlama/hfhome}"

command -v docker >/dev/null 2>&1 || { echo "Docker sunucuda kurulu değil."; exit 1; }
test -f "$ENV_FILE" || { echo ".env.production bulunamadı."; exit 1; }

mkdir -p "$DATA_DIR" "$HFHOME_DIR/.config/higgsfield"
chown -R 1001:1001 "$DATA_DIR" "$HFHOME_DIR"
docker build -t "$IMAGE_NAME" .
docker rm -f "$OLD_NAME" >/dev/null 2>&1 || true

if docker container inspect "$APP_NAME" >/dev/null 2>&1; then
  docker rename "$APP_NAME" "$OLD_NAME"
  docker stop "$OLD_NAME" >/dev/null
fi

restore_previous() {
  docker rm -f "$APP_NAME" >/dev/null 2>&1 || true
  if docker container inspect "$OLD_NAME" >/dev/null 2>&1; then
    docker rename "$OLD_NAME" "$APP_NAME"
    docker start "$APP_NAME" >/dev/null
  fi
}
trap restore_previous INT TERM HUP

set -a
. "./$ENV_FILE"
set +a

docker run -d \
  --name "$APP_NAME" \
  --restart unless-stopped \
  --network coolify \
  --env-file "$ENV_FILE" \
  --mount "type=bind,src=$DATA_DIR,dst=/app/data" \
  --mount "type=bind,src=$HFHOME_DIR,dst=/app/.hfhome" \
  --security-opt no-new-privileges:true \
  --memory 2g \
  --pids-limit 512 \
  --label "traefik.enable=true" \
  --label "traefik.http.middlewares.pazarlama-auth.basicauth.users=$BASIC_AUTH_USERS" \
  --label "traefik.http.middlewares.pazarlama-auth.basicauth.removeheader=true" \
  --label "traefik.http.middlewares.pazarlama-gzip.compress=true" \
  --label "traefik.http.middlewares.pazarlama-redirect.redirectscheme.scheme=https" \
  --label "traefik.http.routers.pazarlama-http.entryPoints=http" \
  --label "traefik.http.routers.pazarlama-http.middlewares=pazarlama-redirect" \
  --label "traefik.http.routers.pazarlama-http.rule=Host(\`$APP_DOMAIN\`) && PathPrefix(\`/\`)" \
  --label "traefik.http.routers.pazarlama-http.service=pazarlama-https" \
  --label "traefik.http.routers.pazarlama-https.entryPoints=https" \
  --label "traefik.http.routers.pazarlama-https.middlewares=pazarlama-auth,pazarlama-gzip" \
  --label "traefik.http.routers.pazarlama-https.rule=Host(\`$APP_DOMAIN\`) && PathPrefix(\`/\`)" \
  --label "traefik.http.routers.pazarlama-https.service=pazarlama-https" \
  --label "traefik.http.routers.pazarlama-https.tls=true" \
  --label "traefik.http.routers.pazarlama-https.tls.certresolver=letsencrypt" \
  --label "traefik.http.services.pazarlama-https.loadbalancer.server.port=4181" \
  "$IMAGE_NAME" >/dev/null

attempt=1
while [ "$attempt" -le 24 ]; do
  if docker exec "$APP_NAME" node -e "fetch('http://127.0.0.1:4181/api/health').then(r=>r.json()).then(x=>process.exit(x.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "ProcessTürk Pazarlama Merkezi yayını sağlıklı → https://$APP_DOMAIN"
    docker rm -f "$OLD_NAME" >/dev/null 2>&1 || true
    docker image prune -f >/dev/null
    trap - INT TERM HUP
    exit 0
  fi
  sleep 5
  attempt=$((attempt + 1))
done

echo "Sağlık kontrolü başarısız."
docker logs --tail=100 "$APP_NAME" || true
restore_previous
exit 1
