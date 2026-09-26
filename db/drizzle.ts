import dotenv from "dotenv";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

dotenv.config();

// Verificamos si DATABASE_URL está definida antes de conectarse
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida en las variables de entorno.");
}

// Dos despliegues, dos drivers:
//
// - Vercel (entorno de desarrollo, usuarios en Neon): el driver HTTP de Neon, el
//   mismo de siempre. Vercel define VERCEL=1 en el build y en runtime, así que no
//   hace falta configurar nada. Se mantiene a propósito: esa app tiene que seguir
//   funcionando exactamente igual mientras la de la VM se asienta.
// - VM (producción, base `portal` del cluster de TimescaleDB): node-postgres, porque
//   ese Postgres habla el protocolo normal por TCP y no tiene el proxy HTTP de Neon.
//   El Pool no abre conexiones hasta la primera query, así que el build (que evalúa
//   este módulo con una DATABASE_URL de mentira) no sale a la red. max chico: son un
//   par de usuarios y el Postgres comparte 8 GB con la ingesta.
//
// El cast unifica el tipo: las dos instancias exponen la misma API de consultas
// (select/insert/update/delete). Lo único que node-postgres tiene y neon-http no son
// las transacciones interactivas: no usar db.transaction() mientras exista la app
// de Vercel, porque ahí falla en runtime.
function createDb() {
  const url = process.env.DATABASE_URL as string;
  if (process.env.VERCEL) {
    return drizzleNeon(url) as unknown as ReturnType<typeof drizzlePg>;
  }
  return drizzlePg({ client: new Pool({ connectionString: url, max: 5 }) });
}

export const db = createDb();
