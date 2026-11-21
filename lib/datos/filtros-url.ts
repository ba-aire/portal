/**
 * @file Filtros de /datos ida y vuelta por la URL.
 * @description `filtrosAUrl` arma el query string que deja "Buscar Datos" y
 * `filtrosDesdeUrl` lo lee al abrir la página, así una búsqueda compartida o
 * recargada se reproduce. Ver lib/filtros-url.ts.
 */

import {
  contaminantesOptions,
  type FiltrosType,
  promedioOptions,
} from "@/app/(main)/datos/contaminante/components/filters";
import { filtrosSchema, LocationEnum } from "@/lib/datos/models";
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
  const esMinutal = filtros.interval === "minute";
  return {
    metrica: filtros.metrica,
    interval: filtros.interval,
    startDate: filtros.startDate,
    endDate: esMinutal ? filtros.startDate : filtros.endDate,
    locations: filtros.locations,
    ...(esMinutal && {
      startHour: filtros.startHour ?? HORA_DESDE_DEFECTO,
      endHour: filtros.endHour ?? HORA_HASTA_DEFECTO,
    }),
  };
}

/** El query string de una búsqueda (la salida de `filtrosParaBuscar`). */
export function filtrosAUrl(filtros: FiltrosType): URLSearchParams {
  const params = new URLSearchParams();
  params.set("metrica", filtros.metrica);
  params.set("interval", filtros.interval);
  if (filtros.startDate) {
    params.set("startDate", filtros.startDate.toISOString());
  }
  if (filtros.endDate) {
    params.set("endDate", filtros.endDate.toISOString());
  }
  if (filtros.locations.trim()) {
    params.set("locations", filtros.locations);
  }
  if (filtros.startHour !== undefined) {
    params.set("startHour", String(filtros.startHour));
  }
  if (filtros.endHour !== undefined) {
    params.set("endHour", String(filtros.endHour));
  }
  return params;
}

/** Las estaciones válidas de la lista, sin repetir y en el orden en que vienen. */
function estacionesDesdeUrl(valor: string | null): string | undefined {
  if (!valor) return undefined;
  const validas = new Set(
    valor
      .split(",")
      .map((s) => s.trim())
      .filter((s) => LocationEnum.safeParse(s).success),
  );
  return validas.size > 0 ? Array.from(validas).join(",") : undefined;
}

/**
 * Los filtros que trae la URL, sobre `base` (lo que la página muestra sin URL).
 * Cada valor se valida por separado y lo inválido se ignora.
 *
 * `busqueda` son los filtros listos para buscar, solo si la URL trae el juego
 * completo (métrica, integración, estaciones, desde y, salvo en minutales,
 * hasta) y pasa la misma validación que el botón "Buscar Datos"; si no, `null`.
 */
export function filtrosDesdeUrl(
  params: ParametrosUrl,
  base: FiltrosType,
): { filtros: FiltrosType; busqueda: FiltrosType | null } {
  const metrica = opcionDesdeUrl(params.get("metrica"), contaminantesOptions);
  const interval = opcionDesdeUrl(params.get("interval"), promedioOptions);
  const locations = estacionesDesdeUrl(params.get("locations"));
  const startDate = fechaDesdeUrl(params.get("startDate"));
  const endDate = fechaDesdeUrl(params.get("endDate"));

  const filtros: FiltrosType = {
    ...base,
    ...(metrica && { metrica }),
    ...(interval && { interval }),
    ...(locations && { locations }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
    ...franjaDesdeUrl(params),
  };

  const completo =
    metrica !== undefined &&
    interval !== undefined &&
    locations !== undefined &&
    startDate !== undefined &&
    (interval === "minute" || endDate !== undefined);
  if (!completo) return { filtros, busqueda: null };

  const busqueda = filtrosParaBuscar(filtros);
  return {
    filtros,
    busqueda: filtrosSchema.safeParse(busqueda).success ? busqueda : null,
  };
}
