// Aplica las migraciones de drizzle/ con el migrator de drizzle-orm, sin drizzle-kit.
//
// Existe para la imagen de la VM: el output standalone de Next no trae drizzle-kit
// (es devDependency) y la base de la VM no es alcanzable desde afuera, así que las
// migraciones corren desde un contenedor efímero de la misma imagen, en la red
// interna de podman. El Dockerfile lo bundlea con esbuild a /app/migrate.js.
//
// Lleva el mismo registro que `npx drizzle-kit migrate` (drizzle.__drizzle_migrations),
// así que los dos caminos son intercambiables contra una misma base.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL no está definida en las variables de entorno.");
}

// Sin top-level await: esbuild lo bundlea como CommonJS, porque pg hace
// require() de módulos de node y un bundle ESM no los puede resolver.
async function main(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), {
      migrationsFolder: process.env.MIGRATIONS_DIR ?? "./drizzle",
    });
    console.log("migraciones aplicadas");
  } finally {
    await pool.end();
  }
}

main(url).catch((error) => {
  console.error(error);
  process.exit(1);
});
