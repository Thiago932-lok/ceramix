# syntax=docker/dockerfile:1

# ---------- dependências ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN npm ci --omit=dev

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/data/ceramix.db

RUN apt-get update \
  && apt-get install -y --no-install-recommends sqlite3 \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data \
  && chown node:node /data

WORKDIR /app/apps/api

COPY --from=deps /app/node_modules /app/node_modules
COPY package.json package-lock.json /app/
COPY apps/api/package.json /app/apps/api/package.json
COPY apps/api/src ./src
COPY apps/api/docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
