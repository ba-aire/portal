#!/usr/bin/env bash
# ===========================================================================
# Deja lista la base `portal` en el stack de dev de ba-aire/data, para correr el
# portal local (`npm run dev`) contra una réplica de la VM: el mismo TimescaleDB,
# las mismas migraciones de airedb y el simulador de cabina escribiendo en bronze.
#
# Requiere los repos hermanos ../data y ../infra, y el stack de data arriba:
#   cd ../data/compose && docker compose --env-file ../.env up -d --build
#
# Hace lo mismo que la VM, con valores de juguete:
#   1. base y rol `portal`   -> db/portal_db.sql de infra (= make portal-db)
#   2. esquema               -> scripts/migrate.ts         (= make portal-migrate)
#   3. un ADMIN de dev       -> scripts/create-user.ts     (= make portal-user)
#
# Es idempotente: correrlo de nuevo no duplica nada (el usuario, si ya existe,
# queda como está).
#
# La password del rol `portal` TIENE que ser la misma que le pone el compose de
# data (PORTAL_PG_PASS en data/.env, `devportal` por defecto): el rol es uno solo
# en el cluster, y con una distinta el portal no entra a airedb.
# ===========================================================================
set -euo pipefail

AQUI="$(cd "$(dirname "$0")/.." && pwd)"
DATA="${DATA_DIR:-$AQUI/../data}"
INFRA="${INFRA_DIR:-$AQUI/../infra}"
PASS="${PORTAL_PG_PASS:-devportal}"

# Usuario ADMIN de dev. Solo existe en esta base local. NO es la cuenta de nadie.
DEV_EMAIL="${DEV_EMAIL:-admin@dev.local}"
DEV_PASS="${DEV_PASS:-Dev-Admin1!}"

test -f "$INFRA/db/portal_db.sql" || { echo "ERROR: no encuentro $INFRA/db/portal_db.sql (INFRA_DIR=...)"; exit 1; }
test -d "$DATA/compose" || { echo "ERROR: no encuentro $DATA/compose (DATA_DIR=...)"; exit 1; }

# MSYS_NO_PATHCONV: en Git Bash de Windows, sin esto los paths del contenedor se
# convierten a paths de Windows y psql no encuentra nada.
export MSYS_NO_PATHCONV=1
compose() { (cd "$DATA/compose" && docker compose --env-file ../.env "$@"); }

echo ">> 1/3 base y rol portal"
compose exec -T -e PORTAL_PG_PASS="$PASS" timescaledb \
  psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$INFRA/db/portal_db.sql"

DATABASE_URL="postgresql://portal:$PASS@localhost:5432/portal"
AIREDB_URL="postgresql://portal:$PASS@localhost:5432/airedb"
export DATABASE_URL

echo ">> 2/3 migraciones"
(cd "$AQUI" && npx tsx scripts/migrate.ts)

echo ">> 3/3 usuario ADMIN de dev"
(cd "$AQUI" && printf '%s' "$DEV_PASS" | npx tsx scripts/create-user.ts \
  --email "$DEV_EMAIL" --name Admin --last-name Dev --role ADMIN) \
  || echo "   (si dice que ya existe, está bien)"

cat <<EOF

Listo. Para el portal local, en .env.local:
  DATABASE_URL=$DATABASE_URL
  AIREDB_URL=$AIREDB_URL
  SESSION_SECRET=<cualquier base64 de 32 bytes: openssl rand -base64 32>
Y después: npm run dev  ->  http://localhost:3000/portal  (usuario: $DEV_EMAIL)
EOF
