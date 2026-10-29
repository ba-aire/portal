import { z } from "zod";

// Esquemas Zod
const formatNumber = (decimals: number = 2) =>
  z
    .number()
    .nullable()
    .optional()
    .transform((val) => {
      if (val === null || val === undefined) return null;
      const multiplier = 10 ** decimals;
      return Math.round(val * multiplier) / multiplier;
    });

// Timestamp flexible para el objeto final (preserva Unix epoch o convierte a Date)
const timeField = z
  .union([
    // Influx may return numeric epoch values in seconds or milliseconds.
    // Detect magnitude: values with >10 digits are treated as milliseconds.
    z.number().transform((val) => {
      const abs = Math.abs(val);
      // If the number looks like milliseconds (length > 10) treat as ms, else as seconds
      const isMilliseconds = abs > 1e11 || val.toString().length > 10;
      return isMilliseconds ? new Date(val) : new Date(val * 1000);
    }),
    z.string(), // String ISO
    z.date(), // Already a Date
    z.null(),
    z.undefined(),
  ])
  .nullable()
  .optional();
const locationField = z.string();
const statusField = z.string().nullable().optional();

// Estaciones válidas. Las queries a InfluxDB se arman por interpolación de string,
// así que este enum es la barrera contra inyección: nunca pasar un location que no
// haya salido de acá al repositorio.
export const LocationEnum = z.enum([
  "centenario",
  "cordoba",
  "catalinas",
  "cifa",
]);
export type Location = z.infer<typeof LocationEnum>;

// Esquemas individuales
export const CoRowSchema = z.object({
  time: timeField,
  location: locationField,
  co_mean: formatNumber(2),
  status: statusField,
});

export const NoxRowSchema = z.object({
  time: timeField,
  location: locationField,
  no2_mean: formatNumber(1),
  no_mean: formatNumber(1),
  nox_mean: formatNumber(1),
  status: statusField,
});

export const O3RowSchema = z.object({
  time: timeField,
  location: locationField,
  o3_mean: formatNumber(2),
  status: statusField,
});

export const So2RowSchema = z.object({
  time: timeField,
  location: locationField,
  so2_mean: formatNumber(2),
  status: statusField,
});

export const Pm10RowSchema = z.object({
  time: timeField,
  location: locationField,
  pm10_mean: formatNumber(2),
  status: statusField,
});

export const Pm25RowSchema = z.object({
  time: timeField,
  location: locationField,
  pm25_mean: formatNumber(2),
  status: statusField,
});

export const MeteoRowSchema = z.object({
  time: timeField,
  location: locationField,
  dv_mean: formatNumber(0),
  hr_in_mean: formatNumber(0),
  hr_mean: formatNumber(0),
  lluvia_mean: formatNumber(2),
  temp_mean: formatNumber(1),
  temp_in_mean: formatNumber(1),
  vv_mean: formatNumber(2),
  pa_mean: formatNumber(0),
  rs_mean: formatNumber(0),
  uv_mean: formatNumber(0),
});

// Esquema para la respuesta combinada
export const FullLocationDataSchema = z.object({
  location: z.string(),
  timestamps: z.object({
    co: timeField,
    nox: timeField,
    o3: timeField,
    so2: timeField,
    pm10: timeField,
    pm25: timeField,
    meteo: timeField,
  }),
  latest_time: timeField,
  // CO data
  co_mean: formatNumber(2),
  co_mean_status: statusField,
  // NOx data
  no2_mean: formatNumber(1),
  no_mean: formatNumber(1),
  nox_mean: formatNumber(1),
  nox_mean_status: statusField,
  // O3 data
  o3_mean: formatNumber(2),
  o3_mean_status: statusField,
  // SO2 data
  so2_mean: formatNumber(2),
  so2_mean_status: statusField,
  // PM10 data
  pm10_mean: formatNumber(0),
  pm10_mean_status: statusField,
  // PM2.5 data
  pm25_mean: formatNumber(1),
  pm25_mean_status: statusField,
  // Meteo data
  dv_mean: formatNumber(0),
  hr_in_mean: formatNumber(0),
  hr_mean: formatNumber(0),
  lluvia_mean: formatNumber(1),
  temp_mean: formatNumber(1),
  temp_in_mean: formatNumber(1),
  vv_mean: formatNumber(1),
  pa_mean: formatNumber(0),
  rs_mean: formatNumber(0),
  uv_mean: formatNumber(0),
  // 👉 Nuevo bloque freshness
  freshness: z
    .object({
      co: z.enum(["fresh", "stale"]),
      nox: z.enum(["fresh", "stale"]),
      o3: z.enum(["fresh", "stale"]),
      so2: z.enum(["fresh", "stale"]),
      pm10: z.enum(["fresh", "stale"]),
      pm25: z.enum(["fresh", "stale"]),
      meteo: z.enum(["fresh", "stale"]),
    })
    .optional(),
});

// Tipos inferidos
export type CoRow = z.infer<typeof CoRowSchema>;
export type NoxRow = z.infer<typeof NoxRowSchema>;
export type O3Row = z.infer<typeof O3RowSchema>;
export type So2Row = z.infer<typeof So2RowSchema>;
export type Pm10Row = z.infer<typeof Pm10RowSchema>;
export type Pm25Row = z.infer<typeof Pm25RowSchema>;
export type MeteoRow = z.infer<typeof MeteoRowSchema>;
export type FullLocationData = z.infer<typeof FullLocationDataSchema>;
export type Status = z.infer<typeof statusField>;
