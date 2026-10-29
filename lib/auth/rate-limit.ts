import { and, count, eq, gte, lt, or } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { loginAttemptTable } from "@/db/schema/login-attempt";

/** Ventana deslizante sobre la que se cuentan los intentos fallidos. */
export const WINDOW_MINUTES = 15;

/**
 * Techos por ventana. El de IP es más alto que el de email a propósito: una
 * oficina detrás de un NAT comparte IP y varias personas pueden equivocarse sin
 * bloquearse entre sí, pero sigue acotando el barrido de muchos usuarios distintos
 * desde un mismo origen.
 */
export const MAX_ATTEMPTS = {
  email: 5,
  ip: 20,
} as const;

export type AttemptKind = keyof typeof MAX_ATTEMPTS;

const WINDOW_MS = WINDOW_MINUTES * 60 * 1000;

function windowStart() {
  return new Date(Date.now() - WINDOW_MS);
}

/**
 * Indica si el par (email, ip) agotó su cupo. Se consulta antes de tocar la
 * contraseña, así que un atacante bloqueado ni siquiera hace trabajar a bcrypt.
 */
export async function isRateLimited(
  email: string,
  ip: string | null,
): Promise<boolean> {
  const since = windowStart();

  const targets = [
    { kind: "email" as const, identifier: email.toLowerCase() },
    ...(ip ? [{ kind: "ip" as const, identifier: ip }] : []),
  ];

  // Una sola query para ambos discriminadores: el login está en el camino
  // crítico y no justifica dos round-trips a Neon.
  const rows = await db
    .select({ kind: loginAttemptTable.kind, total: count() })
    .from(loginAttemptTable)
    .where(
      and(
        gte(loginAttemptTable.attemptedAt, since),
        or(
          ...targets.map((t) =>
            and(
              eq(loginAttemptTable.kind, t.kind),
              eq(loginAttemptTable.identifier, t.identifier),
            ),
          ),
        ),
      ),
    )
    .groupBy(loginAttemptTable.kind);

  return rows.some((row) => row.total >= MAX_ATTEMPTS[row.kind as AttemptKind]);
}

/** Deja registrado un intento fallido para email e IP. */
export async function recordFailedAttempt(
  email: string,
  ip: string | null,
): Promise<void> {
  const values = [
    { kind: "email", identifier: email.toLowerCase() },
    ...(ip ? [{ kind: "ip", identifier: ip }] : []),
  ];

  await db.insert(loginAttemptTable).values(values);

  // Limpieza oportunista: las filas fuera de ventana ya no cuentan para nada y
  // sin esto la tabla crece sin techo. Va acá y no en un cron para no sumar
  // infraestructura; el costo lo paga el que está fallando, no el que entra bien.
  await db
    .delete(loginAttemptTable)
    .where(lt(loginAttemptTable.attemptedAt, windowStart()));
}

/**
 * Borra los intentos de un email tras un login exitoso, para que alguien que se
 * equivocó y después acertó no arrastre el cupo consumido. Los de IP se dejan:
 * si no, un atacante con una credencial válida se limpia el contador a voluntad.
 */
export async function clearAttempts(email: string): Promise<void> {
  await db
    .delete(loginAttemptTable)
    .where(
      and(
        eq(loginAttemptTable.kind, "email"),
        eq(loginAttemptTable.identifier, email.toLowerCase()),
      ),
    );
}
