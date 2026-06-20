# ProcessTürk Pazarlama Komuta Merkezi — Next.js standalone (Coolify/VPS)
FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=1
RUN npm run build

FROM base AS runner
WORKDIR /app
# python3 → Meta kampanya planı scripti · ffmpeg → video render · @higgsfield/cli → üretim motoru
RUN apk add --no-cache python3 ffmpeg \
  && npm i -g @higgsfield/cli@0.2.3

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4181
ENV HOSTNAME="0.0.0.0"
# Üretim motoru varsayılanları (gizli anahtarlar Coolify env'inden gelir)
ENV HOME=/app/.hfhome
ENV GEN_PROVIDER=higgsfield
ENV GEN_TEXT_PROVIDER=openai
ENV HIGGSFIELD_BIN=higgsfield
ENV HF_TTS_MODEL=elevenlabs
ENV PRODUCTS_JSON_PATH=/app/data/products.json

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# sharp native modülü (musl) — Next standalone trace'i libvips .so'larını atlıyor; tam kopyala
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp
# Seed verisi (products.json/content.json/calendar.json) — kalıcı storage mount'u bunu gölgeler
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
# Yazılabilir state + Higgsfield auth (HOME) klasörleri
RUN chmod +x docker-entrypoint.sh \
  && mkdir -p /app/data /app/.hfhome/.config/higgsfield \
  && chown -R nextjs:nodejs /app/data /app/.hfhome

USER nextjs
EXPOSE 4181
ENTRYPOINT ["./docker-entrypoint.sh"]
