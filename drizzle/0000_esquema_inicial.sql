-- Esquema inicial de la base `portal` (VM). REEMPLAZA a las migraciones 0000-0007
-- anteriores, que venían de la app de Vercel: 14 tablas de inventario que nunca se
-- usaron (se superponían con dim.* de airedb y contradecían el ADR 0013 de infra),
-- y retoques hechos a mano en Neon. Se pudo empezar de cero porque la base de la VM
-- todavía no existía; la rama `vercel` conserva su propio historial contra Neon.
--
-- Desde acá, cada cambio de esquema es una migración nueva: nunca editar esta.

CREATE TABLE "login_attempt" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "login_attempt_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" varchar(10) NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "login_attempt_kind_check" CHECK ("login_attempt"."kind" IN ('email', 'ip'))
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(80) NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(10) DEFAULT 'VIEWER' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_role_check" CHECK ("user"."role" IN ('ADMIN', 'EDITOR', 'VIEWER'))
);
--> statement-breakpoint
CREATE INDEX "login_attempt_lookup_idx" ON "login_attempt" USING btree ("kind","identifier","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_lower_idx" ON "user" USING btree (lower("email"));