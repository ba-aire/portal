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

**SIRCA** is an air quality monitoring dashboard (Sistema de Gestión de la Red de Calidad del Aire). On `main` it reads air-quality data from TimescaleDB (`airedb`, owned by `ba-aire/data`) and users from its own `portal` database, both on the VM. It is the only deployment: the old Vercel app (Neon + InfluxDB) and its `vercel` branch were retired in November 2026.

### Dual Database Strategy

- **PostgreSQL, database `portal`** — the app's own data: `user` and `login_attempt`, nothing else. Drizzle ORM (`/db/drizzle.ts`, schemas in `/db/schema/`). Emails are stored lowercase (unique index on `lower(email)`). `user.is_active = false` blocks login. Roles live in `lib/auth/roles.ts`. Equipment/station inventory does NOT belong here: it lives in `dim.*` of `airedb`, declared in `ba-aire/data` (ADR 0013).
- **PostgreSQL, database `airedb`** (TimescaleDB, the regulatory archive owned by `ba-aire/data`) — `/db/airedb.ts`, same `portal` role, **read-only** (V12 in data: SELECT on `bronze`, `silver`, `gold`, `dim`; V17 adds `indice`; V18 adds SELECT on `revision` and EXECUTE on its two write functions; V19 the same for `carga`). Plain parameterized SQL via `queryAiredb()`, no Drizzle: the schema is declared by Flyway in `data`, don't duplicate it here. The session is also `default_transaction_read_only` and runs with `jit=off` (the index views add ~1 s of JIT per query otherwise). Never write to bronze/silver/gold: silver and gold are recomputed from bronze. Manual annul/validate decisions go to the append-only `revision` schema, which data's hourly applies (see `/validacion`).
  - `/estaciones` (`lib/location`) reads the latest **raw reading** of each instrument from bronze, every 5 s by SSE. Field names still say `*_mean` (UI shape from the InfluxDB era).
  - `/datos` (`lib/datos`) reads silver (`minute_reading`, `hourly_reading`) and gold (`v_hourly`, `v_moving_8h`, `v_moving_24h`, valid windows only). Same wide-row response as before, plus `<serie>@status` per minute. Intervals: `minute` (one day at a time, with an hour range; capped server-side), `hour`, `mov8h`, `mov24h`. Hourly has four columns per series: `<serie> (validados)` = gold, and the three silver ones `(crudo)` = `value_raw`, `(crudo con alarmas)` = `value_con_alarma`, `(crudo sin alarmas)` = `value`; the moving means only have `(validados)`, and each point is placed at the END of its window. `lib/datos/series.ts` filters client-side (status checkboxes; validados always on, the three crudos toggled from a select, off by default). No time shifts in the portal: silver's `ts_minute` is the minute START, and the BAM1020 one-hour lag is fixed in data's hourly (V13).
  - `/descargas` (`lib/descargas`) builds the Excel in the browser from one wide row per instant. Hourly: `<p>` = gold.v_hourly (only K minutes), `<p>_raw` = silver `value_raw` (every minute, any status), `<group>_status` (statuses seen, as letters K/A/M/Z/S/C) and `<group>_k_status` (K minutes). Minute: silver `minute_reading`, crudos sheet only. `dv_rumbo` = `dim.rumbo()`, crudos only. The pivot runs in SQL. The **validados** sheet is pasted into the network's general spreadsheet: its 18 columns (`lib/descargas/config.ts`, `h2s` always s/d) must not change. Rain (sum of DayRain increments), wind direction (vector mean) and alarm exclusion are computed by data V14, not here.
  - `/ica` (`lib/ica`; `/aqi` redirects to it) reads the air quality index from `gold.v_ica_horario` (data V16/V17). Two indices in the same views, selected by the `indice` column: `EPA` (US AQI, number 0–500+) and `EEA` (European index, category only, `valor` is null). Every query MUST filter `indice`: categories of one and the other don't mean the same. Nothing is computed here (no breakpoints, no NowCast): the portal only reads. Category names and colours come from `indice.v_categoria`, station coordinates/type/description from `dim.stations`. Each station shows its latest hour within a 6 h window; the city value is the WORST station on screen (`ciudadDe` in the service), not an average. `GET /api/ica?indice=EPA|EEA`, refreshed every 5 min. The map keeps OSM raster tiles, desaturated.
  - `/validacion` (`lib/revision`) is the manual review of the data: invalidate minutes (a parameter or a whole instrument, `measurement`) or reincorporate alarms, over a minute range `[desde, hasta)` in PUBLISHED time (data V18, schema `revision`, append-only). Everyone with a session sees the list; only an **EDITOR** or **ADMIN** registers or annuls (VIEWER only reads), and every write re-checks role and `is_active` in the `portal` database, not just the cookie. Together with `/cargas`, it is the portal's only write to airedb: `revision.registrar()` / `revision.anular()` (SECURITY DEFINER) inside `transaccionDeEscritura()` (`BEGIN READ WRITE`); the role has no INSERT on any table. Data's hourly applies them on its next run (≤5 min). `/datos` shows those minutes with status `invalidado`.
  - `/cargas` (`lib/carga`) is the manual load of hourly averages ALREADY VALIDATED by an operator (e.g. downloaded from an analyzer after a telemetry outage), into data V19's append-only `carga` schema. The file (.csv or .xlsx, one station, wide: `FECHA`, `HORA`, one column per `parameter_code`; Argentina time, units of `dim.parameters`; empty or `s/d` = no data, not loaded) is parsed IN THE BROWSER by `lib/carga/parser.ts` (all-or-nothing; the user says whether `HORA` marks the start or the end of the hour) and sent as a list of hours. Same permission as `/validacion` (EDITOR or ADMIN, re-checked against the `portal` database). Writes only through `carga.cargar('portal', ...)` / `carga.anular()` in `transaccionDeEscritura()`; a load is annulled whole, never edited. In gold the loaded hour WINS over the measured one and is valid without the 75 % (`gold.v_hourly.is_loaded`); silver is untouched. Capped at `MAX_HORAS` per load: the 10-year history is loaded from the VM console, not here.
- **InfluxDB** — gone (it was only used by the retired Vercel app). Locations: `centenario`, `cordoba`, `catalinas`, `cifa`.

### Branches and deployments

- **`main` = production, on the VM** (reachable only through the VPN). The `Dockerfile` builds a standalone image, published to GHCR by `.github/workflows/imagen.yml`. It runs as a quadlet in `ba-aire/infra`, behind caddy, over **plain HTTP** inside the VPN, like the organization's other internal apps (ADR 0017 in infra). Anything that only works with TLS goes through `lib/https.ts`. Images are published ONLY for `vX.Y.Z` tags, not on every merge: a release is `git tag v0.2.0 && git push origin v0.2.0`. Even then nothing deploys by itself: the VM only changes when an infra PR bumps the image digest. Users live in the `portal` database of the TimescaleDB cluster (node-postgres). Pollutant data comes from TimescaleDB (`airedb`).
- There is no other deployment: the `vercel` branch is gone. `vercel.json` stays for now with `git.deploymentEnabled: false`, because the Vercel project is still connected to this repo and without that file Vercel deploys every branch to the internet. Delete it only after the Vercel project is deleted or disconnected.
- Day-to-day work: `feat/*` / `fix/*` branches → PR to `main`.
- `scripts/migrate.ts` is bundled into the image as `migrate.js` to apply `drizzle/` migrations without drizzle-kit. `scripts/create-user.ts` (bundled as `create-user.js`, run by `make portal-user`) creates users, resets passwords and enables/disables accounts from the VM, password via stdin. Never change a database by hand or with `drizzle-kit push`: a fresh database built from `drizzle/` must match the schema. The history restarts at `drizzle/0000_esquema_inicial.sql`; never edit it, add new migrations.

### Layered Data Flow

```
React Hook (useFetchDatos / useFetchDescargas)
  → API Route (/app/api/datos/route.ts, /api/descargas/route.ts)
    → Service Layer (/lib/datos/, /lib/descargas/)
      → Repository Layer (parameterized SQL on airedb via queryAiredb)
```

API routes validate query params with Zod. Services call repositories; request values always travel as `$n` parameters, never interpolated.

### Authentication

- JWT sessions via `jose`, stored in httpOnly cookies, 7-hour expiration.
- `/lib/auth-session.ts` — server-only session management (`verifySession()` redirects unauthenticated users).
- Passwords hashed with `bcryptjs`.
- Protected routes live under `/app/(main)/` and use a shared authenticated layout.

### Routing Structure

- `/app/(main)/` — protected routes (ica, datos, descargas, estaciones, reportes, validacion, cargas)
- `/app/api/` — API route handlers
- `/app/admin/` — admin login
- `/app/login/` — user login

### UI Stack

- **shadcn/ui** (New York style) on top of Radix UI primitives — components in `/components/ui/`
- **Tailwind CSS v4** for styling
- **Chart.js / Recharts** for pollutant data charts
- **Mapbox GL / MapLibre GL** for station maps
- Data tables (`/datos`, `/descargas`) are plain `<table>` elements, no table library
- **Sonner** for toast notifications
- **Lucide React** for icons

### Path Alias

`@/*` maps to the repo root (configured in `tsconfig.json`).

## Environment Variables

```
DATABASE_URL=         # PostgreSQL connection string (VM: base `portal`)
AIREDB_URL=           # Same role `portal`, database `airedb` (read-only). Local: scripts/dev-db.sh prints both
SESSION_SECRET=       # Base64 key for JWT signing
PORTAL_HTTPS=         # "true" only if served behind TLS: re-enables the secure cookie and CSP upgrade-insecure-requests (lib/https.ts). Default: plain HTTP inside the VPN
```

## Testing

Tests live in `/tests/` and use Vitest with jsdom. TypeScript paths resolve via `tsconfig.json`.
