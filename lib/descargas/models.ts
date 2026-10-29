/**
 * @file Definiciones de tipos y esquemas de validación para el módulo de descargas.
 * @description Utiliza Zod para garantizar la integridad de los datos de entrada de filtros,
 * parámetros de consulta a InfluxDB y la estructura de los resultados.
 * @author Ezequiel Maranda
 * @version 1.1.0
 * @since 2026-03-11
 */

import { z } from "zod";
import {
  locationOptions,
  promedioOptions,
} from "@/app/(main)/descargas/components/filters";

// ============================================================================
// ENUMS Y TIPOS BASE
// ============================================================================

export const StatusEnum = z.enum(["k", "i"]);
export type Status = z.infer<typeof StatusEnum>;

export const ContaminantEnum = z.enum([
  "co",
  "no2",
  "no",
  "nox",
  "pm10",
  "pm25",
  "o3",
  "so2",
]);
export type Contaminant = z.infer<typeof ContaminantEnum>;

export const IntegrationEnum = z.enum(["minute", "hour"]);
export type Integration = z.infer<typeof IntegrationEnum>;

export const LocationEnum = z.enum([
  "centenario",
  "cordoba",
  "catalinas",
  "cifa",
]);
export type Location = z.infer<typeof LocationEnum>;

// ============================================================================
// SCHEMAS PARA VALIDACIÓN DE PETICIONES (API/SERVICE)
// ============================================================================

export const QueryParamsSchema = z.object({
  location: LocationEnum.default("centenario"),
  startDate: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), {
      message: "Invalid datetime",
    })
    .default("2025-07-29T00:00:00Z"),
  endDate: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), {
      message: "Invalid datetime",
    })
    .default("2025-07-30T00:00:00Z"),
  integration: IntegrationEnum.default("hour"),
});
export type QueryParams = z.infer<typeof QueryParamsSchema>;

// Tope de ventana por integración, en días. Ver la nota equivalente en
// lib/datos/models.ts: las tablas son minutales y sin límite un solo request
// puede pedir años de datos.
export const MAX_RANGE_DAYS: Record<Integration, number> = {
  minute: 31,
  hour: 366,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const BoundedQueryParamsSchema = QueryParamsSchema.superRefine(
  (p, ctx) => {
    const start = Date.parse(p.startDate);
    const end = Date.parse(p.endDate);

    if (start > end) {
      ctx.addIssue({
        code: "custom",
        message:
          'La fecha "desde" debe ser anterior o igual a la fecha "hasta".',
        path: ["startDate"],
      });
      return;
    }

    const maxDays = MAX_RANGE_DAYS[p.integration];
    if (end - start > maxDays * DAY_MS) {
      ctx.addIssue({
        code: "custom",
        message: `El rango máximo para la integración "${p.integration}" es de ${maxDays} días.`,
        path: ["endDate"],
      });
    }
  },
);

// ============================================================================
// SCHEMAS DE DATOS
// ============================================================================

// Helper to convert BigInt to number and handle null values
const bigIntToNumberOrNull = z.preprocess((val) => {
  if (typeof val === "bigint") {
    return Number(val);
  }
  if (val === null || val === undefined) {
    return null;
  }
  return val;
}, z.union([z.number(), z.string(), StatusEnum, z.null()]).nullable());

// Helper to convert time to string (handles number, Date, string)
// Nota: El cliente @influxdata/influxdb3-client ya convierte nanosegundos a milisegundos
const timeToString = z.preprocess((val) => {
  if (val === null || val === undefined) {
    return "";
  }
  // Si es número (milisegundos), convertir a ISO string
  if (typeof val === "number") {
    return new Date(Math.round(val)).toISOString();
  }
  // Si es BigInt (por si acaso), convertir a milisegundos
  if (typeof val === "bigint") {
    return new Date(Number(val)).toISOString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  // Si ya es string (ISO), devolverlo tal cual
  return String(val);
}, z.string());

export const DataPointSchema = z
  .object({
    time: timeToString,
  })
  .catchall(bigIntToNumberOrNull);
export type DataPoint = z.infer<typeof DataPointSchema>;

export const QueryResultSchema = z.object({
  data: z.array(DataPointSchema),
  meta: z.object({
    location: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    integration: z.string(),
    count: z.number(),
  }),
});
export type QueryResult = z.infer<typeof QueryResultSchema>;

// ============================================================================
// SCHEMAS DE VALIDACIÓN PARA FORMULARIOS Y COMPONENTES UI
// ============================================================================
export const filtrosSchema = z
  .object({
    integration: z
      .string()
      .refine((v) => promedioOptions.some((o) => o.value === v), {
        message: "Seleccioná un tipo de integración.",
      }),
    location: z
      .string()
      .refine((s) => locationOptions.some((o) => o.value === s), {
        message: "Seleccioná una estación válida.",
      }),
    startDate: z.preprocess(
      (arg) => {
        if (arg instanceof Date) return arg;
        if (typeof arg === "string") {
          const d = new Date(arg);
          return Number.isNaN(d.getTime()) ? undefined : d;
        }
        return undefined;
      },
      z.instanceof(Date, {
        message: 'Seleccioná una fecha "desde" válida.',
      }),
    ),
    endDate: z.preprocess(
      (arg) => {
        if (arg instanceof Date) return arg;
        if (typeof arg === "string") {
          const d = new Date(arg);
          return Number.isNaN(d.getTime()) ? undefined : d;
        }
        return undefined;
      },
      z.instanceof(Date, {
        message: 'Seleccioná una fecha "hasta" válida.',
      }),
    ),
  })
  .refine((d) => d.startDate.getTime() <= d.endDate.getTime(), {
    message: 'La fecha "desde" debe ser anterior o igual a la fecha "hasta".',
    path: ["startDate"],
  });
