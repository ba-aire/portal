import { getUserByEmail } from "@/lib/auth/repository";

// Lo que la base rechaza por una razón que quien registra puede corregir: un
// 400 con un mensaje para mostrar. Cualquier otro error sigue siendo un 500.
export class RevisionRechazada extends Error {}

// Mensajes de las CHECK de revision.revision (V18), por nombre de constraint.
// El texto crudo de Postgres trae nombres internos: al usuario, otra cosa.
const CHECKS: Record<string, string> = {
  revision_motivo_ck: "El motivo necesita al menos 10 caracteres",
  revision_periodo_ck:
    "El período tiene que tener principio y fin, en minutos enteros",
  revision_registrado_por_ck: "Falta el usuario que registra",
};

type ErrorDePg = Error & { code?: string; constraint?: string };

/**
 * Traduce un error de revision.registrar() o revision.anular() a algo para el
 * usuario, o lo devuelve tal cual si no es de los esperables.
 *
 *   22023 invalid_parameter_value: lo levantan las funciones con un mensaje
 *         propio en castellano (estación o parámetro desconocido, período
 *         futuro, anular una anulación). Se muestra ese mensaje.
 *   23514 check_violation: una CHECK de la tabla; se traduce por constraint.
 *   23505 unique_violation: la revisión ya estaba anulada.
 */
export function traducirError(error: unknown): unknown {
  const e = error as ErrorDePg;
  switch (e?.code) {
    case "22023":
      return new RevisionRechazada(capitalizar(e.message));
    case "23514":
      return new RevisionRechazada(
        CHECKS[e.constraint ?? ""] ??
          "La revisión no cumple las reglas de la base",
      );
    case "23505":
      return new RevisionRechazada("Esa revisión ya está anulada");
    default:
      return error;
  }
}

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * ¿Puede esta sesión revisar datos? Solo un EDITOR (el ADMIN administra el
 * sistema, no los datos).
 *
 * El rol de la cookie no alcanza para escribir: la sesión dura 7 h y no se
 * vuelve a consultar, así que alguien deshabilitado o pasado a VIEWER seguiría
 * pudiendo. Para una escritura en el archivo regulatorio se pregunta a la base
 * de usuarios en el momento.
 */
export async function esEditorVigente(email: string, rolDeLaSesion: string) {
  if (rolDeLaSesion !== "EDITOR") return false;
  const usuario = await getUserByEmail(email.toLowerCase());
  return usuario?.isActive === true && usuario.role === "EDITOR";
}
