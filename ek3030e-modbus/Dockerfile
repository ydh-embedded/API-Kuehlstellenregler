# ─────────────────────────────────────────────────────────────────────────────
# EK-3030E Modbus Controller – Podman/Docker Multi-Stage Build
#
# Stage 1 (builder): Node.js-Abhängigkeiten installieren + Frontend bauen
# Stage 2 (runtime): Schlankes Produktions-Image mit Node.js + Python
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# pnpm aktivieren
RUN corepack enable && corepack prepare pnpm@latest --activate

# Abhängigkeiten zuerst (Layer-Cache)
COPY package.json pnpm-lock.yaml* ./
COPY patches/ ./patches/

RUN pnpm install --frozen-lockfile

# Quellcode kopieren
COPY . .

# Frontend bauen (Vite) + Server-Bundle (esbuild)
RUN pnpm build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

# Python 3 + pip + pymodbus + supervisor installieren
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        supervisor \
    && pip3 install --no-cache-dir --break-system-packages pymodbus \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Build-Artefakte aus Stage 1 übernehmen
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Python-Bridge kopieren
COPY server/modbus_bridge.py ./server/modbus_bridge.py

# Supervisor-Konfiguration kopieren
COPY supervisord.conf /etc/supervisor/conf.d/ek3030e.conf

# Umgebungsvariablen – Standardwerte für lokalen/Container-Betrieb
# OAuth-Variablen bleiben leer → App startet im lokalen Modus ohne Login-Zwang
ENV NODE_ENV=production \
    PORT=3000 \
    MODBUS_BRIDGE_URL=http://127.0.0.1:8502 \
    MODBUS_BRIDGE_PORT=8502 \
    MODBUS_BRIDGE_HOST=0.0.0.0 \
    JWT_SECRET=local-container-secret-change-in-production \
    OAUTH_SERVER_URL="" \
    VITE_APP_ID="" \
    VITE_OAUTH_PORTAL_URL="" \
    VITE_ANALYTICS_ENDPOINT="" \
    VITE_ANALYTICS_WEBSITE_ID="" \
    OWNER_OPEN_ID="" \
    OWNER_NAME="Lokal"

# Ports freigeben:
#   3000 = Web-Dashboard (Node.js)
#   8502 = Modbus-Bridge (Python, nur intern nötig)
EXPOSE 3000
EXPOSE 8502

# Supervisor startet beide Prozesse
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/ek3030e.conf"]
