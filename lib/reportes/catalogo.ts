import { z } from "zod";
import {
  ContaminanteEnum,
  EstacionEnum,
  etiquetaPlantilla,
  MesSchema,
  type Plantilla,
} from "./config";

/**
 * @file El catálogo de reportes de /reportes.
 * @description Cada reporte es un TIPO (qué filtros pide y cómo se arma) más una
 * plantilla (cómo se ve). La pantalla arranca con un solo select, "Seleccioná
 * la plantilla del reporte", con todo lo que hay acá; al elegir uno carga los
 * filtros de su tipo.
 *
 * Para sumar un reporte:
 *   - otra plantilla de un tipo que ya existe: una entrada en REPORTES;
 *   - un tipo nuevo (diario, anual...): su entrada en TIPOS, su schema de
 *     filtros en `pedidoDe`, su componente de filtros (FILTROS en
 *     reportes-panel.tsx) y su vista previa (page.tsx).
 */

export type TipoReporte = "mensual";

/** Cada tipo, con el nombre del grupo en el select. */
export const TIPOS: Record<TipoReporte, { nombre: string }> = {
  mensual: { nombre: "Mensual" },
};

export type Reporte = {
  /** Lo que va en la URL (?reporte=mensual-nuevo). */
  id: string;
  /** Quién emite el reporte: va al principio de su nombre ("APrA - …"). */
  emisor: string;
  tipo: TipoReporte;
  plantilla: Plantilla;
};

export const REPORTES = [
  {
    id: "mensual-clasico",
    emisor: "APrA",
    tipo: "mensual",
    plantilla: "clasico",
  },
  // "nuevo" (APrA - Plantilla mensual nueva): oculta por ahora. La plantilla
  // sigue en lib/reportes/html/nuevo.tsx; para volver a mostrarla, descomentar:
  // { id: "mensual-nuevo", emisor: "APrA", tipo: "mensual", plantilla: "nuevo" },
  {
    id: "mensual-acumar",
    emisor: "ACUMAR",
    tipo: "mensual",
    plantilla: "acumar",
  },
] as const satisfies readonly Reporte[];

export type ReporteId = (typeof REPORTES)[number]["id"];

/** "APrA - Reporte Mensual"; la plantilla nueva (hoy oculta) lleva su versión. */
export function nombreDelReporte(r: Reporte): string {
  const base = `${r.emisor} - Reporte ${TIPOS[r.tipo].nombre}`;
  return r.plantilla === "nuevo"
    ? `${base} ${etiquetaPlantilla(r.plantilla).toLowerCase()}`
    : base;
}

/** El reporte de ese id, o null si no existe (o no vino). */
export function reporteDe(id: string | null | undefined): Reporte | null {
  return REPORTES.find((r) => r.id === id) ?? null;
}

/** Los reportes agrupados por tipo, en el orden del catálogo: para el select. */
export function reportesPorTipo(): {
  tipo: TipoReporte;
  reportes: Reporte[];
}[] {
  const grupos = new Map<TipoReporte, Reporte[]>();
  for (const r of REPORTES) {
    grupos.set(r.tipo, [...(grupos.get(r.tipo) ?? []), r]);
  }
  return [...grupos].map(([tipo, reportes]) => ({ tipo, reportes }));
}

// ---- Los filtros de cada tipo, desde la URL ------------------------------------

const FiltrosMensualSchema = z.object({
  estacion: EstacionEnum,
  contaminante: ContaminanteEnum,
  mes: MesSchema,
});
export type FiltrosMensual = z.infer<typeof FiltrosMensualSchema>;

/** Lo que pide la URL de /reportes, ya validado; null si falta algo. */
export type Pedido = {
  tipo: "mensual";
  reporte: Reporte;
  filtros: FiltrosMensual;
};

/**
 * El reporte y sus filtros a partir de la URL (?reporte=…&estacion=…). Null si
 * el reporte no existe o si a sus filtros les falta algo: la pantalla muestra el
 * selector y los filtros, sin vista previa.
 */
export function pedidoDe(
  params: Record<string, string | string[] | undefined>,
): Pedido | null {
  const solo = (x: string | string[] | undefined) =>
    Array.isArray(x) ? x[0] : x;
  const reporte = reporteDe(solo(params.reporte));
  if (!reporte) return null;
  switch (reporte.tipo) {
    case "mensual": {
      const parsed = FiltrosMensualSchema.safeParse({
        estacion: solo(params.estacion),
        contaminante: solo(params.contaminante),
        mes: solo(params.mes),
      });
      return parsed.success
        ? { tipo: "mensual", reporte, filtros: parsed.data }
        : null;
    }
  }
}
