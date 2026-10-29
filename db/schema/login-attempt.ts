import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Registro de intentos de login fallidos, para limitar la fuerza bruta.
 *
 * Vive en Postgres y no en memoria porque en serverless cada instancia tiene su
 * propio heap: un contador local se multiplicaría por la cantidad de instancias
 * y se reiniciaría con cada reciclado, así que no limitaría nada.
 *
 * Deliberadamente NO usa commonColumns: son filas efímeras que se borran al
 * cerrarse la ventana, no entidades de negocio con borrado lógico.
 */
export const loginAttemptTable = pgTable(
  "login_attempt",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    // Se limita por email y por IP en paralelo: sólo por IP se saltea rotando
    // proxies, y sólo por email permite bloquear a propósito la cuenta ajena.
    // El discriminador evita que una IP con forma de email colisione con un email.
    kind: varchar({ length: 10 }).notNull(), // "email" | "ip"
    identifier: varchar({ length: 255 }).notNull(),
    attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
  },
  (table) => [
    // El conteo siempre filtra por (kind, identifier) y ventana de tiempo.
    index("login_attempt_lookup_idx").on(
      table.kind,
      table.identifier,
      table.attemptedAt,
    ),
  ],
);

export type LoginAttemptSelect = InferSelectModel<typeof loginAttemptTable>;
export type LoginAttemptInsert = InferInsertModel<typeof loginAttemptTable>;
