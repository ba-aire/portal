-- Alinea una base creada DESDE CERO con lo que Neon ya tiene.
--
-- La nota de 0006 lo explica: `lastName` y la baja de `user_name_unique` se
-- aplicaron a Neon por fuera de las migraciones, y en 0006 se quitaron a mano
-- porque ahí ya existían. Pero ninguna migración los crea, así que una base
-- nueva (la de la VM) quedaba sin `lastName`, y el login fallaba en el primer
-- SELECT de user. Además rechazaba a dos personas con el mismo nombre.
--
-- IF [NOT] EXISTS en las dos sentencias: en Neon no hacen nada. NOT NULL sin
-- DEFAULT sólo funciona porque en una base nueva la tabla está vacía. Los
-- usuarios llegan después, con el import de Neon, que ya trae el apellido.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lastName" varchar(40) NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_name_unique";
