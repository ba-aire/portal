/**
 * @file Las columnas de las descargas.
 * @description Cada grupo es un equipo de la cabina (una measurement de bronze):
 * sus parámetros van juntos en el Excel, con un status y un conteo de minutos
 * válidos por grupo. EL ORDEN DE ESTE ARCHIVO ES EL ORDEN DE LAS COLUMNAS, y la
 * hoja "validados" se pega en la planilla general: cambiarlo rompe ese pegado.
 * @author Ezequiel Maranda
 * @version 2.0.0
 * @since 2026-03-11
 */

/**
 * Sufijo del conteo de minutos K de cada grupo en la hora (`nox_k_count`): un
 * entero de 0 a 60, que se muestra sin decimales en la tabla, el CSV y el Excel.
 */
export const SUFIJO_CONTEO_K = "_k_count";
export const esConteoK = (columna: string) => columna.endsWith(SUFIJO_CONTEO_K);

// Decimales de cada métrica, según la precisión del instrumento. Los usan la
// tabla de la página, el CSV y el Excel, para que muestren lo mismo.
const DECIMALES_POR_METRICA: Record<string, number> = {
  co: 3,
  no: 2,
  no2: 2,
  nox: 2,
  so2: 2,
  o3: 2,
  // Material particulado, en µg/m³: un decimal.
  pm10: 1,
  pm25: 1,
  dv: 1,
  vv: 1,
  temp: 1,
  hr: 1,
  pa: 1,
  uv: 1,
  lluvia: 1,
  rs: 1,
};

/**
 * Decimales con que se muestra una columna numérica (`co`, `pm10_raw`,
 * `nox_k_count`), o `undefined` si no es de una métrica conocida.
 */
export function decimalesDe(columna: string): number | undefined {
  if (esConteoK(columna)) return 0;
  const base = columna.endsWith("_raw") ? columna.slice(0, -4) : columna;
  return DECIMALES_POR_METRICA[base];
}

export const TABLE_CONFIG = {
  nox: { metrics: ["no", "no2", "nox"] },
  co: { metrics: ["co"] },
  o3: { metrics: ["o3"] },
  pm10: { metrics: ["pm10"] },
  pm25: { metrics: ["pm25"] },
  so2: { metrics: ["so2"] },
  // No hay sensor de H2S en la red ni parámetro en dim.parameters: la columna
  // existe solo para que validados conserve el formato de la planilla general,
  // y sale siempre "s/d".
  h2s: { metrics: ["h2s"] },
  meteo: {
    metrics: ["dv", "vv", "temp", "hr", "pa", "uv", "lluvia", "rs"],
  },
} as const;

export type TableConfig = typeof TABLE_CONFIG;

/**
 * Columnas derivadas que van solo en crudos (y en el CSV), pegadas a su
 * métrica. Validados no las lleva: su formato es el de la planilla general.
 */
export const DERIVED_COLUMNS: Record<string, string> = {
  dv: "dv_rumbo",
};

/**
 * Columna de la consulta horaria con los parámetros cuya hora viene de una
 * carga manual (V19 en ba-aire/data), separados por coma. No es una columna del
 * Excel: se usa para pintar la celda, y va tal cual solo en el CSV.
 */
export const COLUMNA_CARGADAS = "cargadas";
