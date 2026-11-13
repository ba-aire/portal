// Lo que la base rechaza por una razón que quien carga puede corregir: un 400
// con un mensaje para mostrar. Cualquier otro error sigue siendo un 500.
export class CargaRechazada extends Error {}

// Mensajes de las CHECK del schema `carga` (V19), por nombre de constraint.
const CHECKS: Record<string, string> = {
  carga_motivo_ck: "El motivo necesita al menos 10 caracteres",
  carga_registrado_por_ck: "Falta el usuario que registra",
  hora_en_punto_ck: "Las horas tienen que estar en punto",
};

type ErrorDePg = Error & { code?: string; constraint?: string };

/**
 * Traduce un error de carga.cargar() o carga.anular(), igual que
 * lib/revision/service.ts con los de revision:
 *
 *   22023 el mensaje propio de la función (estación o parámetro desconocido,
 *         horas que no terminaron, horas repetidas, anular una anulación).
 *   23514 una CHECK de las tablas; se traduce por constraint.
 *   23505 la carga ya estaba anulada.
 */
export function traducirError(error: unknown): unknown {
  const e = error as ErrorDePg;
  switch (e?.code) {
    case "22023":
      return new CargaRechazada(
        e.message.charAt(0).toUpperCase() + e.message.slice(1),
      );
    case "23514":
      return new CargaRechazada(
        CHECKS[e.constraint ?? ""] ??
          "La carga no cumple las reglas de la base",
      );
    case "23505":
      return new CargaRechazada("Esa carga ya está anulada");
    default:
      return error;
  }
}
