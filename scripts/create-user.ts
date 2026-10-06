// Alta y mantenimiento de usuarios del portal desde la VM, sin pasar por la web.
//
// Existe para el primer ADMIN (sin un ADMIN no se puede entrar a /admin) y para lo
// que /admin no hace: cambiar una contraseña y deshabilitar o rehabilitar a alguien.
// El Dockerfile lo bundlea con esbuild a /app/create-user.js; lo corre
// `make portal-user` en ba-aire/infra, en un contenedor efímero de la misma imagen.
//
// LA CONTRASEÑA ENTRA POR STDIN, nunca por argumento: un argumento queda en el
// historial del shell y en `ps`. El Makefile la pide sin eco y la pasa por un pipe.
//
// Uso:
//   printf '%s' 'clave' | node create-user.js --email a@b.gob.ar --name Ana --last-name Paz --role ADMIN
//   printf '%s' 'clave' | node create-user.js --email a@b.gob.ar --reset
//   node create-user.js --email a@b.gob.ar --desactivar
//   node create-user.js --email a@b.gob.ar --activar
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { userTable } from "@/db/schema/user";
import { RegisterFormSchema } from "@/lib/auth/form-validations";

// Mismo costo que registerUser (lib/auth/service.ts): un usuario creado acá y uno
// creado desde /admin tienen que ser indistinguibles.
const BCRYPT_COST = 10;

async function leerStdin(): Promise<string> {
  const partes: Buffer[] = [];
  for await (const parte of process.stdin) {
    partes.push(parte as Buffer);
  }
  // Solo el salto de línea final que agrega un `echo` o un Enter; el resto de la
  // contraseña queda intacto.
  return Buffer.concat(partes)
    .toString("utf8")
    .replace(/\r?\n$/, "");
}

function fallar(mensaje: string): never {
  console.error(`ERROR: ${mensaje}`);
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      "last-name": { type: "string" },
      role: { type: "string", default: "VIEWER" },
      reset: { type: "boolean", default: false },
      desactivar: { type: "boolean", default: false },
      activar: { type: "boolean", default: false },
    },
  });

  const url = process.env.DATABASE_URL;
  if (!url) fallar("DATABASE_URL no está definida.");
  if (!values.email) fallar("falta --email.");
  const email = values.email.trim().toLowerCase();

  const modos = [values.reset, values.desactivar, values.activar].filter(
    Boolean,
  );
  if (modos.length > 1)
    fallar("--reset, --desactivar y --activar son excluyentes.");

  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle({ client: pool });

  try {
    const [existente] = await db
      .select({ id: userTable.id, isActive: userTable.isActive })
      .from(userTable)
      .where(eq(userTable.email, email));

    // ---- habilitar / deshabilitar ------------------------------------------
    if (values.desactivar || values.activar) {
      if (!existente) fallar(`no existe un usuario con email ${email}.`);
      const isActive = Boolean(values.activar);
      await db
        .update(userTable)
        .set({ isActive })
        .where(eq(userTable.email, email));
      console.log(`${email}: ${isActive ? "habilitado" : "deshabilitado"}.`);
      if (!isActive) {
        console.log(
          "Una sesión ya abierta sigue valiendo hasta que vence (7 h). Para cortarla ya, rotar portal-session-secret.",
        );
      }
      return;
    }

    const password = await leerStdin();

    // ---- cambiar contraseña ----------------------------------------------------
    if (values.reset) {
      if (!existente) fallar(`no existe un usuario con email ${email}.`);
      const check = RegisterFormSchema.shape.password.safeParse(password);
      if (!check.success)
        fallar(check.error.issues.map((i) => i.message).join(" "));
      await db
        .update(userTable)
        .set({ password: await bcrypt.hash(check.data, BCRYPT_COST) })
        .where(eq(userTable.email, email));
      console.log(`${email}: contraseña actualizada.`);
      return;
    }

    // ---- alta ------------------------------------------------------------------
    if (existente) {
      fallar(
        `ya existe un usuario con email ${email}. Para cambiarle la contraseña: --reset.`,
      );
    }
    // Las mismas reglas que el formulario de /admin: un usuario creado por acá no
    // puede tener una contraseña que la web rechazaría.
    const datos = RegisterFormSchema.safeParse({
      name: values.name,
      lastName: values["last-name"],
      email,
      password,
      role: values.role,
    });
    if (!datos.success) {
      fallar(
        datos.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("\n       "),
      );
    }
    const [creado] = await db
      .insert(userTable)
      .values({
        name: datos.data.name,
        lastName: datos.data.lastName,
        email: datos.data.email,
        password: await bcrypt.hash(datos.data.password, BCRYPT_COST),
        role: datos.data.role,
      })
      .returning({ id: userTable.id });
    console.log(
      `usuario creado: ${datos.data.email} (${datos.data.role}), id ${creado.id}.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
