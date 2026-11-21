/**
 * @file Lectura de los filtros desde la URL, compartida por /datos y /descargas.
 * @description Los filtros se escriben en el query string al buscar
 * (`router.replace`), así una búsqueda se puede compartir o recargar. Estas
 * piezas leen cada valor por separado y descartan lo que no valida: una URL
 * vieja o editada a mano completa lo que puede y deja el resto como estaba.
 */

import { HORA_DESDE_DEFECTO, HORA_HASTA_DEFECTO } from "@/lib/rango-minutal";

/** Lo mínimo que se usa de `URLSearchParams` (también `ReadonlyURLSearchParams`). */
export type ParametrosUrl = Pick<URLSearchParams, "get">;

/** Una fecha del query string, o `undefined` si falta o no es una fecha. */
export function fechaDesdeUrl(valor: string | null): Date | undefined {
  if (!valor) return undefined;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}

function horaDesdeUrl(
  valor: string | null,
  min: number,
  max: number,
): number | undefined {
  if (!valor || !/^\d{1,2}$/.test(valor)) return undefined;
  const hora = Number(valor);
  return hora >= min && hora <= max ? hora : undefined;
}

/**
 * La franja horaria de los minutales ("desde" 0-23, "hasta" 1-24 exclusivo).
 * Si las dos están y no forman una franja ("hasta" antes de "desde"), no se
 * usa ninguna: no hay forma de saber cuál de las dos sobra.
 */
export function franjaDesdeUrl(params: ParametrosUrl): {
  startHour?: number;
  endHour?: number;
} {
  const startHour = horaDesdeUrl(params.get("startHour"), 0, 23);
  const endHour = horaDesdeUrl(params.get("endHour"), 1, 24);
  if (
    (endHour ?? HORA_HASTA_DEFECTO) <= (startHour ?? HORA_DESDE_DEFECTO) ||
    (startHour === undefined && endHour === undefined)
  ) {
    return {};
  }
  return {
    ...(startHour !== undefined && { startHour }),
    ...(endHour !== undefined && { endHour }),
  };
}

/** El valor si es una de las opciones, si no `undefined`. */
export function opcionDesdeUrl<T extends string>(
  valor: string | null,
  opciones: readonly { value: string }[],
): T | undefined {
  return valor !== null && opciones.some((o) => o.value === valor)
    ? (valor as T)
    : undefined;
}
