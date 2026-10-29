import { z } from "zod";
import {
  contaminantesOptions,
  promedioOptions,
} from "@/app/(main)/datos/contaminante/components/filters";

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
  "pm1025",
  "o3",
  "so2",
]);
export type Contaminant = z.infer<typeof ContaminantEnum>;

export const IntervalEnum = z.enum(["minute", "hour", "day"]);
export type Interval = z.infer<typeof IntervalEnum>;

export const LocationEnum = z.enum([
  "centenario",
  "cordoba",
  "catalinas",
  "cifa",
]);
export type Location = z.infer<typeof LocationEnum>;

// ============================================================================
// SCHEMAS DE REQUEST/RESPONSE
// ============================================================================

export const QueryParamsSchema = z.object({
  contaminant: ContaminantEnum.default("co"),
  // LocationEnum, no z.string(): el repositorio interpola cada valor en SQL crudo,
  // dos veces (dentro del WHERE y como alias de columna entre comillas dobles).
  locations: z
    .string()
    .transform((val) => val.split(",").map((loc) => loc.trim()))
    .pipe(z.array(LocationEnum).nonempty())
    .default(["centenario", "cordoba", "catalinas", "cifa"]),
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
  interval: IntervalEnum.default("hour"),
});
export type QueryParams = z.infer<typeof QueryParamsSchema>;

// Tope de ventana por intervalo, en días. Las tablas son minutales: sin límite,
// un solo request puede pedir años de datos y agotar la cuota de InfluxDB.
// El techo acompaña la granularidad — a menor resolución, más rango razonable.
export const MAX_RANGE_DAYS: Record<Interval, number> = {
  minute: 31,
  hour: 366,
  day: 1830, // ~5 años
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

    const maxDays = MAX_RANGE_DAYS[p.interval];
    if (end - start > maxDays * DAY_MS) {
      ctx.addIssue({
        code: "custom",
        message: `El rango máximo para el intervalo "${p.interval}" es de ${maxDays} días.`,
        path: ["endDate"],
      });
    }
  },
);

// ============================================================================
// SCHEMAS DE DATOS
// ============================================================================

export const DataPointSchema = z
  .object({
    time: z.string(),
  })
  .catchall(z.union([z.number(), z.string(), StatusEnum]));
export type DataPoint = z.infer<typeof DataPointSchema>;

export const QueryResultSchema = z.object({
  data: z.array(DataPointSchema),
  meta: z.object({
    contaminant: ContaminantEnum,
    locations: z.array(z.string()),
    startDate: z.string(),
    endDate: z.string(),
    interval: IntervalEnum,
    count: z.number(),
  }),
});
export type QueryResult = z.infer<typeof QueryResultSchema>;

// Validación con Zod para los inputs de en filtros
export const filtrosSchema = z
  .object({
    metrica: z
      .string()
      .refine((v) => contaminantesOptions.some((o) => o.value === v), {
        message: "Seleccioná una métrica válida.",
      }),
    interval: z
      .string()
      .refine((v) => promedioOptions.some((o) => o.value === v), {
        message: "Seleccioná un tipo de integración.",
      }),
    locations: z.string().refine(
      (s) =>
        (s || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean).length > 0,
      { message: "Seleccioná al menos una estación." },
    ),
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
