/**
 * @file Filtros de /descargas ida y vuelta por la URL.
 * @description Igual que lib/datos/filtros-url.ts, con los filtros de
 * descargas: una estación, integración minutal u horaria.
 */

import {
  type FiltrosType,
  locationOptions,
  promedioOptions,
} from "@/app/(main)/descargas/components/filters";
import { filtrosSchema } from "@/lib/descargas/models";
import {
  fechaDesdeUrl,
  franjaDesdeUrl,
  opcionDesdeUrl,
  type ParametrosUrl,
} from "@/lib/filtros-url";
import { HORA_DESDE_DEFECTO, HORA_HASTA_DEFECTO } from "@/lib/rango-minutal";

/**
 * Lo que se manda a buscar: en minutales el día es uno solo ("hasta" = "desde")
 * y la franja horaria siempre va, con su valor por defecto si no se eligió.
 */
export function filtrosParaBuscar(filtros: FiltrosType): FiltrosType {
  const esMinutal = filtros.integration === "minute";
  return {
    integration: filtros.integration,
    startDate: filtros.startDate,
    endDate: esMinutal ? filtros.startDate : filtros.endDate,
    location: filtros.location,
    ...(esMinutal && {
      startHour: filtros.startHour ?? HORA_DESDE_DEFECTO,
      endHour: filtros.endHour ?? HORA_HASTA_DEFECTO,
    }),
  };
}

/** El query string de una búsqueda (la salida de `filtrosParaBuscar`). */
export function filtrosAUrl(filtros: FiltrosType): URLSearchParams {
  const params = new URLSearchParams();
  params.set("integration", filtros.integration);
  if (filtros.startDate) {
    params.set("startDate", filtros.startDate.toISOString());
  }
  if (filtros.endDate) {
    params.set("endDate", filtros.endDate.toISOString());
  }
  params.set("location", filtros.location);
  if (filtros.startHour !== undefined) {
    params.set("startHour", String(filtros.startHour));
  }
  if (filtros.endHour !== undefined) {
    params.set("endHour", String(filtros.endHour));
  }
  return params;
}

/**
 * Los filtros que trae la URL, sobre `base` (lo que la página muestra sin URL).
 * Cada valor se valida por separado y lo inválido se ignora.
 *
 * `busqueda` son los filtros listos para buscar, solo si la URL trae el juego
 * completo (estación, integración, desde y, salvo en minutales, hasta) y pasa
 * la misma validación que el botón "Buscar Datos"; si no, `null`.
 */
export function filtrosDesdeUrl(
  params: ParametrosUrl,
  base: FiltrosType,
): { filtros: FiltrosType; busqueda: FiltrosType | null } {
  const location = opcionDesdeUrl<FiltrosType["location"]>(
    params.get("location"),
    locationOptions,
  );
  const integration = opcionDesdeUrl<FiltrosType["integration"]>(
    params.get("integration"),
    promedioOptions,
  );
  const startDate = fechaDesdeUrl(params.get("startDate"));
  const endDate = fechaDesdeUrl(params.get("endDate"));

  const filtros: FiltrosType = {
    ...base,
    ...(location && { location }),
    ...(integration && { integration }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
    ...franjaDesdeUrl(params),
  };

  const completo =
    location !== undefined &&
    integration !== undefined &&
    startDate !== undefined &&
    (integration === "minute" || endDate !== undefined);
  if (!completo) return { filtros, busqueda: null };

  const busqueda = filtrosParaBuscar(filtros);
  return {
    filtros,
    busqueda: filtrosSchema.safeParse(busqueda).success ? busqueda : null,
  };
}
