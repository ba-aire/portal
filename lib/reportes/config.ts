/**
 * @file Qué reportes mensuales hay y cómo se presentan.
 * @description La cuenta (promedios, estadísticos, excedencias, perfil horario)
 * la hace ba-aire/data, en las funciones del schema `reporte` (V20 y
 * R__reporte_mensual.sql). Acá solo vive lo que es PRESENTACIÓN: qué estaciones
 * se publican, qué parámetros lleva cada contaminante, con cuántos decimales se
 * escriben, los rótulos y las escalas de los gráficos de la versión clásica.
 */

import { z } from "zod";

// ---- Plantillas -------------------------------------------------------------
// Dos versiones del mismo reporte, con los MISMOS números:
//   clasico  reproduce la planilla Excel que se subía a buenosaires.gob.ar:
//            mismas tablas, mismo orden, mismos gráficos.
//   nuevo    rediseño: resumen arriba, notas de método, procedencia del dato.
// Cada una lleva una versión (`v1.1`) y la fecha en que se cambió por última vez
// su DISEÑO; las dos van impresas en el pie de cada página. Cambiar el diseño de
// una plantilla es subir su versión y su fecha acá: así un PDF viejo se
// distingue de uno nuevo sin abrirlos lado a lado.
//   - versión menor (1.0 → 1.1): cambios de estilo o de orden, mismo contenido
//   - versión mayor (1.x → 2.0): se agrega o se saca contenido
// La clásica copia la planilla y no se rediseña: su versión casi no cambia, el
// selector de la pantalla muestra solo su nombre y el PDF no la imprime (la
// planilla no tenía pie).
//
// `acumar` es la clásica para ACUMAR: las mismas hojas, y las excedencias
// cuentan además la Ley 20284 (NOx en 1 hora, 450 ppb). `normas` son las normas
// contra las que se cuentan las excedencias (prefijos de norma.v_limite.norma,
// en el orden en que se listan; ver reporte.mensual_excedencias en data).
export const PlantillaEnum = z.enum(["clasico", "acumar", "nuevo"]);
export type Plantilla = z.infer<typeof PlantillaEnum>;

export const PLANTILLAS: Record<
  Plantilla,
  {
    nombre: string;
    version: string;
    fecha: string;
    descripcion: string;
    normas: string[];
    /** Si el selector de plantilla muestra la versión junto al nombre. */
    versionVisible: boolean;
  }
> = {
  clasico: {
    nombre: "Clásica",
    // 1.0 (2026-11-18): copia del PDF publicado.
    // 1.1 (2026-11-21): tamaños de letra y alto de fila del PDF que exporta
    //     hoy la planilla.
    // 1.2 (2026-11-21): "Percentiles" con 95 y 98 como la planilla, líneas
    //     gruesas en los encabezados, el estándar de NO2 rotulado en el
    //     gráfico del NOx y sin la leyenda de versión al pie.
    version: "1.2",
    fecha: "2026-11-21",
    versionVisible: false,
    normas: ["Res. 68/APRA/21"],
    descripcion:
      "El formato de siempre: las mismas tablas y gráficos que la planilla Excel.",
  },
  acumar: {
    nombre: "Clásica",
    // 1.0 (2026-11-21): la clásica 1.2 más la Ley 20284.
    version: "1.0",
    fecha: "2026-11-21",
    versionVisible: false,
    normas: ["Ley 20284", "Res. 68/APRA/21"],
    descripcion:
      "La clásica para ACUMAR: suma el nivel admisible de NOx de la Ley Nacional 20284.",
  },
  nuevo: {
    nombre: "Nueva",
    // 1.0 (2026-11-18): la dirección "A · Institucional".
    // 1.1 (2026-11-21): banda con los colores del portal (skill sirca-design).
    // 1.2 (2026-11-21): banda centrada, logo y etiqueta más chicos en las
    //     esquinas, con la subgerencia.
    // 1.3 (2026-11-21): "APrA / Red de Calidad del Aire" junto al logo, como
    //     la barra lateral; título más grande, el mes debajo de la estación y
    //     doble borde turquesa y amarillo.
    // 1.4 (2026-11-21): banda sobria ("C"), alineada a la izquierda, con una
    //     sola línea turquesa, logo en un cuadrado como el de la barra lateral;
    //     las excedencias dicen la etapa de la Res. 68.
    // 1.5 (2026-11-21): "Reporte Mensual" pasa de la esquina a la línea de la
    //     estación y el mes; "Res. 68/APRA/21 3ra etapa", sin coma.
    version: "1.5",
    fecha: "2026-11-21",
    versionVisible: true,
    normas: ["Res. 68/APRA/21"],
    descripcion:
      "Rediseño con resumen del mes, notas de método e instrumentos que midieron.",
  },
};

/** "Nueva v1.1" o "Clásica": como se muestra en el selector. */
export function etiquetaPlantilla(p: Plantilla): string {
  const pl = PLANTILLAS[p];
  return pl.versionVisible ? `${pl.nombre} v${pl.version}` : pl.nombre;
}

// ---- Estaciones publicadas ----------------------------------------------------
// Las tres que tienen página en buenosaires.gob.ar. `catalinas` es el código de
// La Boca en airedb (dim.stations), por la cabina original.
export const EstacionEnum = z.enum(["centenario", "catalinas", "cordoba"]);
export type Estacion = z.infer<typeof EstacionEnum>;

export const ESTACIONES: Record<
  Estacion,
  { nombre: string; titulo: string; rotulo: string }
> = {
  centenario: {
    nombre: "Parque Centenario",
    titulo: "ESTACIÓN PARQUE CENTENARIO",
    rotulo: "Estación Parque Centenario",
  },
  catalinas: {
    nombre: "La Boca",
    titulo: "ESTACIÓN LA BOCA",
    rotulo: "Estación La Boca",
  },
  cordoba: {
    nombre: "Córdoba",
    titulo: "ESTACIÓN CÓRDOBA",
    rotulo: "Estación Córdoba",
  },
};

// ---- Contaminantes -------------------------------------------------------------
// Un reporte por contaminante. El de NOx lleva tres parámetros (NO, NO2, NOx),
// como la planilla. `parametroPerfil` es el que se grafica en el perfil horario
// cuando hay varios (la planilla grafica solo el NOx).
//
// `escalas` es el máximo del eje Y de cada gráfico de la versión clásica, el
// mismo que tenía la planilla para que los meses se comparen a simple vista. Si
// un mes lo supera, el eje crece (maximoDelEje, lib/reportes/graficos.ts).
export const ContaminanteEnum = z.enum([
  "co",
  "nox",
  "pm10",
  "pm25",
  "so2",
  "o3",
]);
export type Contaminante = z.infer<typeof ContaminanteEnum>;

export type ConfigContaminante = {
  parametros: string[];
  /** Nombre en el título del reporte, en mayúsculas como la planilla. */
  titulo: string;
  /** Nombre corto para los gráficos ("Monóxido de Carbono"). */
  nombre: string;
  /** La unidad como se imprime. */
  unidad: string;
  decimales: number;
  /** El pie que define la unidad. */
  definicionUnidad: string | null;
  parametroPerfil: string;
  escalas: { diario: number; bloques: number; horario: number; perfil: number };
  /** El paso de las marcas del eje Y de cada gráfico, como la planilla. */
  pasos: { diario: number; bloques: number; horario: number; perfil: number };
};

const PPB_GAS = (gas: string) =>
  `PPB: Una parte en volumen de ${gas} en mil millones de partes en volumen de Aire Ambiente`;

export const CONTAMINANTES: Record<Contaminante, ConfigContaminante> = {
  co: {
    parametros: ["co"],
    titulo: "MONÓXIDO DE CARBONO (PPM)",
    nombre: "Monóxido de Carbono",
    unidad: "PPM",
    decimales: 1,
    definicionUnidad:
      "PPM: Una parte en volumen de Monóxido de Carbono en un millón de partes en volumen de Aire Ambiente",
    parametroPerfil: "co",
    escalas: { diario: 3, bloques: 10, horario: 35, perfil: 1.6 },
    pasos: { diario: 0.5, bloques: 0.5, horario: 5, perfil: 0.2 },
  },
  nox: {
    parametros: ["no", "no2", "nox"],
    titulo: "ÓXIDOS DE NITRÓGENO (PPB)",
    nombre: "Óxidos de Nitrógeno",
    unidad: "PPB",
    decimales: 0,
    definicionUnidad: PPB_GAS("Óxido de Nitrógeno"),
    parametroPerfil: "nox",
    escalas: { diario: 200, bloques: 200, horario: 600, perfil: 110 },
    pasos: { diario: 10, bloques: 10, horario: 50, perfil: 10 },
  },
  pm10: {
    parametros: ["pm10"],
    titulo: "MATERIAL PARTICULADO MENOR A 10 MICRONES (PM10) - µg/m³",
    nombre: "Material Particulado (PM10)",
    unidad: "µg/m³",
    decimales: 0,
    definicionUnidad: null,
    parametroPerfil: "pm10",
    escalas: { diario: 200, bloques: 200, horario: 300, perfil: 100 },
    pasos: { diario: 10, bloques: 10, horario: 20, perfil: 10 },
  },
  pm25: {
    parametros: ["pm25"],
    titulo: "MATERIAL PARTICULADO MENOR A 2,5 MICRONES (PM2,5) - µg/m³",
    nombre: "Material Particulado (PM2,5)",
    unidad: "µg/m³",
    decimales: 0,
    definicionUnidad: null,
    parametroPerfil: "pm25",
    escalas: { diario: 100, bloques: 100, horario: 150, perfil: 60 },
    pasos: { diario: 10, bloques: 10, horario: 10, perfil: 5 },
  },
  so2: {
    parametros: ["so2"],
    titulo: "DIÓXIDO DE AZUFRE (PPB)",
    nombre: "Dióxido de Azufre",
    unidad: "PPB",
    decimales: 0,
    definicionUnidad: PPB_GAS("Dióxido de Azufre"),
    parametroPerfil: "so2",
    escalas: { diario: 50, bloques: 50, horario: 100, perfil: 30 },
    pasos: { diario: 5, bloques: 5, horario: 10, perfil: 5 },
  },
  o3: {
    parametros: ["o3"],
    titulo: "OZONO (PPB)",
    nombre: "Ozono",
    unidad: "PPB",
    decimales: 0,
    definicionUnidad: PPB_GAS("Ozono"),
    parametroPerfil: "o3",
    escalas: { diario: 100, bloques: 100, horario: 150, perfil: 80 },
    pasos: { diario: 10, bloques: 10, horario: 10, perfil: 10 },
  },
};

// ---- Encabezado institucional ---------------------------------------------------
// Las líneas que encabezan cada página de la versión clásica, tal cual la
// planilla. Si cambia el organigrama, se cambia acá.
export const ENCABEZADO_INSTITUCIONAL = [
  "GOBIERNO DE LA CIUDAD DE BUENOS AIRES",
  "SECRETARIA DE AMBIENTE",
  "AGENCIA DE PROTECCIÓN AMBIENTAL",
  "DIRECCIÓN GENERAL DE CONTROL AMBIENTAL",
  "Gerencia Operativa de Determinaciones Ambientales y Laboratorio",
  "Subgerencia Operativa Monitoreo Atmosférico",
];

export const NOTA_EPA =
  "* Datos recabados con Monitores automáticos en cumplimiento de Normas de la Environmental Protection Agency (EPA-EU)";

// ---- El mes -----------------------------------------------------------------------
// "2026-09". El reporte es del mes calendario en hora de Buenos Aires.
export const MesSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes inválido: se espera AAAA-MM");

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2026-09" → "SEPTIEMBRE 2026". */
export function nombreDelMes(mes: string): string {
  const [anio, m] = mes.split("-");
  return `${MESES[Number(m) - 1].toUpperCase()} ${anio}`;
}
