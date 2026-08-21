FROM node:20-slim AS builder
WORKDIR /app

# This machine sits behind a corporate TLS-inspection proxy (Zscaler), which
# re-signs outbound HTTPS with its own root CA. The host trusts it already;
# a fresh Docker image doesn't, so without this, npm/prisma HTTPS calls fail
# with UNABLE_TO_GET_ISSUER_CERT_LOCALLY. Harmless no-op on networks that
# don't intercept TLS.
COPY zscaler.crt /usr/local/share/ca-certificates/zscaler.crt
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/zscaler.crt

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY zscaler.crt /usr/local/share/ca-certificates/zscaler.crt
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends ca-certificates openssl curl \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/zscaler.crt

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY package.json ./

EXPOSE 3001

# migrate deploy applies committed migrations, then db seed (idempotent
# upserts) makes sure the app is immediately usable after `docker compose up`.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/server.js"]
