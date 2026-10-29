import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
// Relativo y no "@/...": drizzle-kit carga este archivo por su cuenta.
import { ROLES, type Role } from "../../lib/auth/roles";

/**
 * Usuarios del portal. Son pocos y los crea un ADMIN, desde /admin o con
 * `make portal-user` en la VM (scripts/create-user.ts).
 *
 * El email se guarda SIEMPRE en minúsculas (lo normalizan los esquemas de zod y el
 * script). El índice único va sobre lower(email) igual, para que la base rechace
 * "Ana@" y "ana@" aunque algún camino futuro se olvide de normalizar.
 */
export const userTable = pgTable(
  "user",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 80 }).notNull(),
    lastName: varchar("last_name", { length: 80 }).notNull(),
    // text y no varchar(40): un correo institucional como
    // nombre.apellido@buenosaires.gob.ar ya pasa los 35 caracteres.
    email: text().notNull(),
    password: text("password_hash").notNull(),
    role: varchar({ length: 10 }).$type<Role>().default("VIEWER").notNull(),
    // Deshabilitar a alguien sin borrarlo: el login lo rechaza con el mismo
    // mensaje que una contraseña incorrecta. Una sesión ya abierta dura hasta que
    // vence (7 h): no se vuelve a consultar en cada request.
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_email_lower_idx").on(sql`lower(${table.email})`),
    check(
      "user_role_check",
      sql`${table.role} IN (${sql.raw(ROLES.map((r) => `'${r}'`).join(", "))})`,
    ),
  ],
);

export type UserSelect = InferSelectModel<typeof userTable>;
export type UserInsert = InferInsertModel<typeof userTable>;
