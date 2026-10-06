/**
 * Roles válidos. Fuente única para el CHECK de la tabla user (db/schema/user.ts),
 * la validación del formulario de /admin y el script de alta (scripts/create-user.ts).
 * Vive fuera de db/schema para que el formulario, que corre en el cliente, no
 * arrastre drizzle al bundle.
 */
export const ROLES = ["ADMIN", "EDITOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];
