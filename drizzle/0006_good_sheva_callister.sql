CREATE TABLE "login_attempt" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "login_attempt_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" varchar(10) NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"attempted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "login_attempt_lookup_idx" ON "login_attempt" USING btree ("kind","identifier","attempted_at");

-- Nota: drizzle-kit generó además `DROP CONSTRAINT "user_name_unique"` y
-- `ADD COLUMN "lastName"` sobre la tabla user. Se quitaron a mano porque ambos
-- cambios ya están aplicados en la base: el snapshot de drizzle venía desfasado
-- de la realidad. Ejecutarlos habría abortado la migración entera y esta tabla
-- no se habría creado. El snapshot 0006 ya refleja el estado real.