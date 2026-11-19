# One service: the API also serves the built web app on the same origin.
FROM node:22-slim AS web
WORKDIR /web
COPY web-app/package.json web-app/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web-app/ ./
RUN npm run build

FROM node:22-slim AS api
WORKDIR /app
COPY api/package.json api/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY api/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=prod \
    APP_NAME=spotplan \
    WEB_DIST=/app/web \
    DATABASE_SSL=true \
    DATABASE_SSL_CA=/etc/ssl/certs/ca-certificates.crt \
    TRUST_PROXY=uniquelocal
WORKDIR /app
COPY --from=api /app/node_modules ./node_modules
COPY --from=api /app/dist ./dist
COPY --from=api /app/package.json ./
COPY --from=web /web/dist ./web
USER node
EXPOSE 3000
# Schema, roles and the demo account are brought up to date on every start.
CMD ["sh", "-c", "npm run migration:run:prod && npm run seed:prod && npm run demo:prod && node dist/main"]
