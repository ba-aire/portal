import type { Catalogo, Revision } from "./models";

// Lo que la pantalla de Validación necesita para mostrar y armar pedidos, sin
// React: se prueba aparte.

/** Nombre de cada equipo (measurement de dim.parameters) para el selector. */
const EQUIPOS: Record<string, string> = {
  co: "CO",
  nox: "NOx",
  o3: "O3",
  so2: "SO2",
  pm10: "PM10",
  pm25: "PM2.5",
  meteo: "Meteorología",
};

export function nombreEquipo(measurement: string) {
  return EQUIPOS[measurement] ?? measurement;
}

export type OpcionSerie = { value: string; label: string };

/**
 * Las opciones del selector de serie: primero los equipos completos que miden
 * más de un parámetro (invalidar el NOx es invalidar no, no2 y nox), después
 * cada parámetro suelto. El valor codifica el tipo: "m:nox" o "p:no2".
 */
export function opcionesDeSerie(parametros: Catalogo["parametros"]): {
  equipos: OpcionSerie[];
  parametros: OpcionSerie[];
} {
  const porEquipo = new Map<string, string[]>();
  for (const p of parametros) {
    porEquipo.set(p.measurement, [
      ...(porEquipo.get(p.measurement) ?? []),
      p.parameter_code,
    ]);
  }
  return {
    equipos: [...porEquipo]
      .filter(([, codigos]) => codigos.length > 1)
      .map(([m, codigos]) => ({
        value: `m:${m}`,
        label: `Equipo ${nombreEquipo(m)} (${codigos.join(", ")})`,
      })),
    parametros: parametros.map((p) => ({
      value: `p:${p.parameter_code}`,
      label: p.display_name,
    })),
  };
}

/** De "m:nox" / "p:no2" a los dos campos del pedido (uno queda en null). */
export function serieDeOpcion(valor: string): {
  parameter_code: string | null;
  measurement: string | null;
} {
  if (valor.startsWith("m:")) {
    return { parameter_code: null, measurement: valor.slice(2) };
  }
  if (valor.startsWith("p:")) {
    return { parameter_code: valor.slice(2), measurement: null };
  }
  return { parameter_code: null, measurement: null };
}

/** Cómo se muestra la serie de una revisión en el listado. */
export function etiquetaSerie(
  r: Pick<Revision, "parameter_code" | "measurement">,
  parametros: Catalogo["parametros"],
) {
  if (r.measurement) return `Equipo ${nombreEquipo(r.measurement)}`;
  return (
    parametros.find((p) => p.parameter_code === r.parameter_code)
      ?.display_name ??
    r.parameter_code ??
    ""
  );
}

/**
 * El valor de un <input type="datetime-local"> ("2026-11-10T14:30") es hora
 * local del navegador, como el resto del portal (lib/rango-minutal.ts). A ISO
 * en UTC para el pedido; null si está vacío o es inválido.
 */
export function localAIso(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Un instante para mostrar, en hora local: "10/11/2026 14:30". */
export function formatearInstante(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Etiquetas de los status de minuto de silver, en el orden en que se muestran. */
export const STATUS: Array<{ value: string; label: string }> = [
  { value: "ok", label: "OK" },
  { value: "alarm", label: "Alarma" },
  { value: "zero", label: "Cero" },
  { value: "span", label: "Span" },
  { value: "service", label: "Mantenimiento" },
  { value: "no_link", label: "Sin conexión" },
  { value: "unknown", label: "Desconocido" },
  { value: "invalidado", label: "Ya invalidado" },
];
