# Imagen del portal para la VM (quadlet en ba-aire/infra). Vercel no la usa.
#
# La buildea el CI (.github/workflows/imagen.yml) y la publica en GHCR; la VM solo
# la pullea por digest. No se buildea en la VM: necesita salida a npm y el build de
# Next se come la RAM que comparten TimescaleDB y la ingesta.
#
# Probar local:
#   docker build -t portal .
#   docker run --rm -p 3000:3000 -e DATABASE_URL=... -e SESSION_SECRET=... portal

ARG NODE_VERSION=24-slim

# ---- dependencias ------------------------------------------------------------
# slim (glibc) y no alpine: tailwind oxide y lightningcss traen sus binarios
# nativos para linux-x64-gnu (ver optionalDependencies).
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ---- build -------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# db/drizzle.ts y lib/auth-session.ts tiran error en tiempo de import si falta la
# variable, y `next build` evalúa esos módulos. Valores de mentira, igual que en el
# CI: el build no abre conexiones. Quedan SOLO en esta etapa; la imagen final no los
# hereda y los valores reales llegan como podman secrets.
RUN DATABASE_URL=postgresql://build:build@build.invalid/build \
    SESSION_SECRET=YnVpbGQtb25seS1kdW1teS1zZWNyZXQtMzJieXRlcw== \
    npm run build

# Los scripts de operación van aparte del server: standalone solo incluye lo que
# las rutas importan, y drizzle-kit es devDependency. Cada uno es un solo archivo,
# con pg adentro. migrate.js aplica drizzle/; create-user.js da de alta usuarios.
RUN for s in migrate create-user; do \
      npx esbuild scripts/$s.ts --bundle --platform=node --format=cjs \
        --external:pg-native --outfile=$s.js || exit 1; \
    done

# ---- runtime -----------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# 0.0.0.0: el server tiene que escuchar en la interfaz de la red de podman, donde
# lo alcanza el reverse proxy. Con el default (hostname del contenedor) anda igual,
# pero así no depende de cómo resuelva el nombre.
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/migrate.js ./migrate.js
COPY --from=builder --chown=node:node /app/create-user.js ./create-user.js
COPY --from=builder --chown=node:node /app/drizzle ./drizzle

USER node
EXPOSE 3000

# Operación: mismo contenedor, otro comando (los corre el Makefile de infra):
#   podman run --rm ... <imagen> node migrate.js        (make portal-migrate)
#   podman run -i --rm ... <imagen> node create-user.js (make portal-user)
CMD ["node", "server.js"]
