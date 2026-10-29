/**
 * @file Configuración de las tablas de descargas para la generación de archivos CSV y Excel.
 * @description Las Metricas se van a descargar en excel en el orden que las pongas en cada metric dentro de TABLE_CONFIG.
 * @author Ezequiel Maranda
 * @version 1.0.0
 * @since 2026-03-11
 */

// Table configurations with their respective metrics
export const TABLE_CONFIG = {
  nox: {
    table: "nox_minutales",
    metrics: ["no_mean", "no2_mean", "nox_mean"],
  },
  co: {
    table: "co_minutales",
    metrics: ["co_mean"],
  },
  o3: {
    table: "o3_minutales",
    metrics: ["o3_mean"],
  },
  pm10: {
    table: "pm10_minutales",
    metrics: ["pm10_mean"],
  },
  pm25: {
    table: "pm25_minutales",
    metrics: ["pm25_mean"],
  },
  so2: {
    table: "so2_minutales",
    metrics: ["so2_mean"],
  },
  h2s: {
    table: "h2s_minutales",
    metrics: ["h2s_mean"],
  },
  meteo: {
    table: "meteo_minutales",
    metrics: [
      "dv_mean",
      "vv_mean",
      "temp_mean",
      "hr_mean",
      "pa_mean",
      "uv_mean",
      "lluvia_mean",
      "rs_mean",
    ],
  },
} as const;

export type TableConfig = typeof TABLE_CONFIG;
