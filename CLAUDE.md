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

Database migrations (via Drizzle Kit):
```bash
npx drizzle-kit generate   # Generate migration from schema changes
npx drizzle-kit migrate    # Apply migrations to Neon PostgreSQL
```

## Architecture

**SIRCA** is an air quality monitoring dashboard (Sistema de Gestión de la Red de Calidad del Aire). It ingests time-series pollutant data from InfluxDB and user/auth data from PostgreSQL (Neon serverless).

### Dual Database Strategy

- **PostgreSQL** — users, roles, authentication, inventory. Neon on Vercel; the `portal` database of the TimescaleDB cluster on the VM. Accessed via Drizzle ORM with the node-postgres driver (`/db/drizzle.ts`, schemas in `/db/schema/`).

### VM deployment

`Dockerfile` builds a standalone image (published to GHCR by `.github/workflows/imagen.yml`) that runs as a quadlet in `ba-aire/infra` behind caddy, reachable only through the VPN. `scripts/migrate.ts` is bundled into the image as `migrate.js` to apply `drizzle/` migrations without drizzle-kit. Never change a database by hand or with `drizzle-kit push`: a fresh database built from `drizzle/` must match the schema (see `drizzle/0007_*`).
- **InfluxDB** — minute-level air quality measurements (`/db/influx.ts`). Tables follow pattern `{pollutant}_minutales` (e.g., `co_minutales`, `pm25_minutales`). Locations: `centenario`, `cordoba`, `catalinas`, `cifa`.

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
DATABASE_URL=         # Neon PostgreSQL connection string
INFLUXDB_TOKEN=       # InfluxDB auth token
SESSION_SECRET=       # Base64 key for JWT signing
```

## Testing

Tests live in `/tests/` and use Vitest with jsdom. TypeScript paths resolve via `tsconfig.json`.
