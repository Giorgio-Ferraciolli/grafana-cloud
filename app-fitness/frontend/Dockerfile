FROM node:20-slim AS builder
WORKDIR /app

# This machine sits behind a corporate TLS-inspection proxy (Zscaler), which
# re-signs outbound HTTPS with its own root CA. The host trusts it already;
# a fresh Docker image doesn't, so without this, npm HTTPS calls fail with
# UNABLE_TO_GET_ISSUER_CERT_LOCALLY. Harmless no-op on networks that don't
# intercept TLS.
COPY zscaler.crt /usr/local/share/ca-certificates/zscaler.crt
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends ca-certificates \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/zscaler.crt

COPY package.json ./
RUN npm install

COPY . .

ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
