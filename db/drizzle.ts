import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

dotenv.config();

// Verificamos si DATABASE_URL está definida antes de conectarse
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida en las variables de entorno.");
}

// node-postgres y no el driver HTTP de Neon: en la VM la base es el Postgres del
// cluster de TimescaleDB, que habla el protocolo normal por TCP. La app de Vercel,
// que sigue en Neon, vive en la rama `vercel` con su driver original.
//
// El Pool no abre ninguna conexión hasta la primera query, así que el build (que
// evalúa este módulo con una DATABASE_URL de mentira) no sale a la red.
// max chico: son un par de usuarios y el Postgres comparte 8 GB con la ingesta.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

export const db = drizzle({ client: pool });
