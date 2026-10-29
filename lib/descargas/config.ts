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
