import "server-only";

import { Pool } from "pg";

// Conexión a airedb, el archivo regulatorio de la VM: bronze, silver, gold y dim.
// Es OTRA base que la del portal (db/drizzle.ts, usuarios), con el mismo rol
// `portal`, que en airedb solo tiene SELECT (V12 en ba-aire/data).
//
// Sin drizzle a propósito: el esquema de airedb lo declara ba-aire/data con
// Flyway, y replicarlo en TypeScript sería una segunda copia que puede
// desincronizarse sin aviso. Acá va SQL con parámetros ($1, $2...), nunca
// interpolando valores.
//
// Se crea en la primera consulta y no al importar el módulo: así el build (que
// evalúa los módulos de las rutas) no necesita una AIREDB_URL de mentira.

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.AIREDB_URL;
  if (!url) {
    throw new Error("AIREDB_URL no está definida en las variables de entorno.");
  }
  pool = new Pool({
    connectionString: url,
    // Un par de usuarios, cada uno con una pestaña de estación que consulta cada
    // 5 s. El Postgres comparte la VM con la ingesta: pocas conexiones.
    max: 5,
    // Defensa en profundidad, además del GRANT: la sesión no puede escribir aunque
    // algún día el rol tuviera permisos de más. Y una consulta colgada no se come
    // una conexión del pool para siempre: con refresco cada 5 s, una que tarde más
    // de eso ya llega tarde.
    options:
      "-c default_transaction_read_only=on -c statement_timeout=10000 -c application_name=portal",
  });
  return pool;
}

/** Corre una consulta parametrizada contra airedb y devuelve sus filas. */
export async function queryAiredb<T>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}
