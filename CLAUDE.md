# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with Turbopack at localhost:3000
npm run build        # Production build
npm run lint         # Biome linter
npm run format       # Biome formatter (writes changes)
npm run check        # Biome lint + format + import organization (read-only)
npm run test         # Run tests with Vitest
npm run test:watch   # Watch mode tests
npm run test:coverage # Coverage report
```

Database migrations (via Drizzle Kit, for the `portal` database only):
```bash
npx drizzle-kit generate   # Generate a migration from schema changes in db/schema/
```
They are applied on the VM by `make portal-migrate` (infra), which runs the bundled `migrate.js` from the image.

## Architecture

**SIRCA** is an air quality monitoring dashboard (Sistema de Gestión de la Red de Calidad del Aire). It ingests time-series pollutant data from InfluxDB and user/auth data from PostgreSQL (Neon serverless).

### Dual Database Strategy

- **PostgreSQL, database `portal`** — the app's own data: `user` and `login_attempt`, nothing else. Drizzle ORM (`/db/drizzle.ts`, schemas in `/db/schema/`). Emails are stored lowercase (unique index on `lower(email)`). `user.is_active = false` blocks login. Roles live in `lib/auth/roles.ts`. Equipment/station inventory does NOT belong here: it lives in `dim.*` of `airedb`, declared in `ba-aire/data` (ADR 0013).
- **PostgreSQL, database `airedb`** (TimescaleDB, the regulatory archive owned by `ba-aire/data`) — `/db/airedb.ts`, same `portal` role, **read-only** (V12 in data: SELECT on `bronze`, `silver`, `gold`, `dim`). Plain parameterized SQL via `queryAiredb()`, no Drizzle: the schema is declared by Flyway in `data`, don't duplicate it here. The session is also `default_transaction_read_only`. Never write to bronze/silver/gold: silver and gold are recomputed from bronze. Future annul/validate decisions go to a dedicated append-only schema that gold applies.
  - `/estaciones` (`lib/location`) reads the latest **raw reading** of each instrument from bronze, every 5 s by SSE. Field names still say `*_mean` (UI shape from the InfluxDB era).
- **InfluxDB** — still used by `lib/datos` and `lib/descargas` until they move to silver/gold (`/db/influx.ts`, tables `{pollutant}_minutales`). Locations: `centenario`, `cordoba`, `catalinas`, `cifa`.

### Branches and deployments

- **`main` = production, on the VM** (reachable only through the VPN). The `Dockerfile` builds a standalone image, published to GHCR by `.github/workflows/imagen.yml`. It runs as a quadlet in `ba-aire/infra`, behind caddy, over **plain HTTP** inside the VPN, like the organization's other internal apps (ADR 0017 in infra). Anything that only works with TLS goes through `lib/https.ts`. Images are published ONLY for `vX.Y.Z` tags, not on every merge: a release is `git tag v0.2.0 && git push origin v0.2.0`. Even then nothing deploys by itself: the VM only changes when an infra PR bumps the image digest. Users live in the `portal` database of the TimescaleDB cluster (node-postgres). Pollutant data will come from TimescaleDB (phase 2).
- **`vercel` = the development app on Vercel** (Neon + InfluxDB), frozen at the pre-VM `main`. Vercel's Production Branch is `vercel`. It only gets fixes, through PRs targeting it directly. Never merge `main` into it: they diverge on purpose. Later it becomes a cabin/equipment status app.
- `vercel.json` on `main` sets `git.deploymentEnabled: false`, so Vercel creates no deployment for `main` or any branch cut from it. The `vercel` branch has its own `vercel.json`, which is what lets it deploy. Vercel reads `vercel.json` from the commit being pushed.
- Day-to-day work: `feat/*` / `fix/*` branches → PR to `main`.
- `scripts/migrate.ts` is bundled into the image as `migrate.js` to apply `drizzle/` migrations without drizzle-kit. `scripts/create-user.ts` (bundled as `create-user.js`, run by `make portal-user`) creates users, resets passwords and enables/disables accounts from the VM, password via stdin. Never change a database by hand or with `drizzle-kit push`: a fresh database built from `drizzle/` must match the schema. The history restarts at `drizzle/0000_esquema_inicial.sql`; never edit it, add new migrations.

### Layered Data Flow

```
React Hook (useFetchDatos / useFetchDescargas)
  → API Route (/app/api/datos/route.ts, /api/descargas/route.ts)
    → Service Layer (/lib/datos/, /lib/descargas/)
      → Repository Layer (InfluxDB queries)
```

API routes validate query params with Zod. Services call repositories which build dynamic InfluxDB SQL queries.

### Authentication

- JWT sessions via `jose`, stored in httpOnly cookies, 7-hour expiration.
- `/lib/auth-session.ts` — server-only session management (`verifySession()` redirects unauthenticated users).
- Passwords hashed with `bcryptjs`.
- Protected routes live under `/app/(main)/` and use a shared authenticated layout.

### Routing Structure

- `/app/(main)/` — protected routes (aqi, datos, descargas, estaciones, reportes)
- `/app/api/` — API route handlers
- `/app/admin/` — admin login
- `/app/login/` — user login

### UI Stack

- **shadcn/ui** (New York style) on top of Radix UI primitives — components in `/components/ui/`
- **Tailwind CSS v4** for styling
- **Chart.js / Recharts** for pollutant data charts
- **Mapbox GL / MapLibre GL** for station maps
- **TanStack Table** for data tables
- **Sonner** for toast notifications
- **Lucide React** for icons

### Path Alias

`@/*` maps to the repo root (configured in `tsconfig.json`).

## Environment Variables

```
DATABASE_URL=         # PostgreSQL connection string (VM: base `portal`)
AIREDB_URL=           # Same role `portal`, database `airedb` (read-only). Local: scripts/dev-db.sh prints both
INFLUXDB_TOKEN=       # InfluxDB auth token
SESSION_SECRET=       # Base64 key for JWT signing
PORTAL_HTTPS=         # "true" only if served behind TLS: re-enables the secure cookie and CSP upgrade-insecure-requests (lib/https.ts). Default: plain HTTP inside the VPN
```

## Testing

Tests live in `/tests/` and use Vitest with jsdom. TypeScript paths resolve via `tsconfig.json`.
