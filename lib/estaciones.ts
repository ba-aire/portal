/**
 * @file Las cuatro estaciones de la red: código, nombres y color.
 * @description Única fuente de verdad del portal para todo lo que nombra o
 * pinta una estación (menú lateral, filtros, gráficos, tablas, descargas).
 * Los nombres viven en código a propósito, no se leen de `dim.stations` en
 * airedb. El código es el de airedb (`station_code`): `catalinas` es La Boca,
 * por la cabina original.
 *
 * Los colores no se definen acá: son las variables `--color-*` de
 * app/globals.css. Este módulo solo las nombra.
 */

import { z } from "zod";

// En el orden en que se muestran (menú lateral, filtros).
export const CODIGOS_ESTACION = [
  "centenario",
  "catalinas",
  "cordoba",
  "cifa",
] as const;

// La puerta de entrada de cualquier estación que llega de afuera (URL, query
// string): una que no existe ni llega al repositorio, y menos a la base.
export const EstacionEnum = z.enum(CODIGOS_ESTACION);
export type Estacion = z.infer<typeof EstacionEnum>;

export interface DatosEstacion {
  /** Nombre corto: menú lateral, filtros, gráficos, tablas. */
  nombre: string;
  /** Nombre largo, para títulos formales (reportes). */
  nombreLargo: string;
  /** Clase de Tailwind del fondo, sobre `--color-<código>`. */
  claseFondo: string;
}

// Las clases van escritas enteras (y no armadas con el código) para que
// Tailwind las encuentre al escanear el código fuente.
export const ESTACIONES: Record<Estacion, DatosEstacion> = {
  centenario: {
    nombre: "Centenario",
    nombreLargo: "Parque Centenario",
    claseFondo: "bg-centenario",
  },
  catalinas: {
    nombre: "La Boca",
    nombreLargo: "La Boca",
    claseFondo: "bg-catalinas",
  },
  cordoba: {
    nombre: "Córdoba",
    nombreLargo: "Córdoba",
    claseFondo: "bg-cordoba",
  },
  cifa: {
    nombre: "CIFA",
    nombreLargo: "CIFA",
    claseFondo: "bg-cifa",
  },
};

/** Fondo de lo que no es ninguna de las cuatro (`--color-otra`). */
export const CLASE_FONDO_OTRA = "bg-otra";
export const COLOR_OTRA = "var(--color-otra)";

export function esEstacion(codigo: string): codigo is Estacion {
  return EstacionEnum.safeParse(codigo).success;
}

/** Nombre corto de la estación; un código desconocido vuelve tal cual. */
export function nombreEstacion(codigo: string): string {
  return esEstacion(codigo) ? ESTACIONES[codigo].nombre : codigo;
}

/** Clase de fondo de la estación; una desconocida va con `bg-otra`. */
export function claseFondoEstacion(codigo: string): string {
  return esEstacion(codigo) ? ESTACIONES[codigo].claseFondo : CLASE_FONDO_OTRA;
}

/** Opciones de un select o una lista de checkboxes de estaciones. */
export const OPCIONES_ESTACION = CODIGOS_ESTACION.map((codigo) => ({
  label: ESTACIONES[codigo].nombre,
  value: codigo,
}));

/** URL de la página en vivo de la estación (/estaciones/<código>). */
export function urlEstacion(codigo: Estacion): string {
  return `/estaciones/${codigo}`;
}

// Separa "<código>[ <resto>]" en estación y resto. El resto es lo que agrega
// cada vista: el parámetro ("NO2", "PM25") y la fuente ("(validados)").
function partirSerie(
  serie: string,
): { estacion: Estacion; resto: string } | null {
  const espacio = serie.indexOf(" ");
  const codigo = espacio === -1 ? serie : serie.slice(0, espacio);
  if (!esEstacion(codigo)) return null;
  return {
    estacion: codigo,
    resto: espacio === -1 ? "" : serie.slice(espacio),
  };
}

/**
 * Rótulo de una serie o columna para la persona que la lee: el código de la
 * estación al principio se cambia por su nombre ("catalinas NO2" → "La Boca
 * NO2"). Lo que no empieza con una estación sale con la inicial en mayúscula,
 * como hasta ahora ("co" → "Co").
 */
export function nombreSerie(serie: string): string {
  const partes = partirSerie(serie);
  if (partes) return `${ESTACIONES[partes.estacion].nombre}${partes.resto}`;
  return serie.charAt(0).toUpperCase() + serie.slice(1);
}

// Parámetros que tienen color propio por estación en app/globals.css
// (`--color-<código>-<parámetro en minúscula>`). Cualquier otro va con el color
// de la estación si la serie es solo el código, o con `--color-otra`.
const PARAMETROS_CON_COLOR = ["NO", "NO2", "NOx", "PM10", "PM25"];

/**
 * Color de una serie de /datos, sin la fuente ("centenario", "cordoba NO2",
 * "cifa PM25"): la variable CSS de la estación o, si la tiene, la de ese
 * parámetro en esa estación.
 */
export function colorSerie(serieBase: string): string {
  const partes = partirSerie(serieBase);
  if (!partes) return COLOR_OTRA;
  const parametro = partes.resto.trim();
  if (parametro === "") return `var(--color-${partes.estacion})`;
  if (!PARAMETROS_CON_COLOR.includes(parametro)) return COLOR_OTRA;
  return `var(--color-${partes.estacion}-${parametro.toLowerCase()})`;
}
