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
    //
    // jit=off: las vistas del índice (gold.v_ica_*) tienen un plan caro en el
    // papel, y el JIT de PostgreSQL lo compila aunque devuelva cuatro filas: suma
    // cerca de 1 s fijo por consulta (medido en ba-aire/data). Todas las
    // consultas del portal son chicas; ninguna gana nada con el JIT.
    options:
      "-c default_transaction_read_only=on -c statement_timeout=10000 -c jit=off -c application_name=portal",
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

/**
 * Corre `fn` en una transacción de ESCRITURA y la confirma; ante cualquier
 * error, ROLLBACK y relanza.
 *
 * La sesión es read-only por defecto (arriba): lo único que el rol `portal`
 * puede escribir en airedb son las revisiones manuales, y solo a través de
 * revision.registrar() y revision.anular() (V18 en ba-aire/data, SECURITY
 * DEFINER). Esas funciones insertan, así que necesitan una transacción que se
 * abra explícitamente como READ WRITE. El GRANT sigue siendo la defensa: el
 * portal no tiene INSERT sobre ninguna tabla.
 */
export async function transaccionDeEscritura<T>(
  fn: (
    consulta: <F>(text: string, params?: unknown[]) => Promise<F[]>,
  ) => Promise<T>,
): Promise<T> {
  const cliente = await getPool().connect();
  try {
    await cliente.query("BEGIN READ WRITE");
    const resultado = await fn(
      async <F>(text: string, params: unknown[] = []) => {
        const r = await cliente.query(text, params);
        return r.rows as F[];
      },
    );
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}
