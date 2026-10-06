import { queryAiredb } from "@/db/airedb";
import { FullLocationDataSchema, type Location } from "./models";

// Tiempo real de una estación: la ÚLTIMA LECTURA CRUDA de cada instrumento, tal
// como llegó a bronze (cada 5-30 s según el equipo), con su status. No es un
// promedio: los promedios por minuto y por hora viven en silver, y los valida
// gold. La página de /estaciones la pide cada 5 s por SSE.
//
// Los campos de la respuesta se siguen llamando `*_mean` porque es la forma que
// consume la UI desde la época de InfluxDB (FullLocationDataSchema). Renombrarlos
// es un cambio de UI aparte; acá el nombre no describe el valor.

/** Measurements de bronze, en el orden de la respuesta. Lista fija: NUNCA viene del request. */
const MEASUREMENTS = [
  "co",
  "nox",
  "o3",
  "so2",
  "pm10",
  "pm25",
  "meteo",
] as const;
type Measurement = (typeof MEASUREMENTS)[number];

// Hasta dónde se mira hacia atrás. Acota el barrido al chunk más reciente, que
// no está comprimido, aunque una cabina lleve días sin transmitir. Es mucho más
// que el umbral de dato viejo (service.ts): lo que cae entre los dos llega a la
// UI y se marca como vencido, en vez de desaparecer.
const VENTANA = "15 minutes";

type Fila = {
  measurement: Measurement;
  time: Date;
  status: string | null;
  // Las columnas de métricas de esa tabla de bronze (co, no, no2, dv, temp...).
  v: Record<string, number | null>;
};

// Una sola consulta: cada tabla aporta su fila más reciente para la estación.
// to_jsonb(t) menos las columnas fijas deja exactamente las métricas, sin
// repetir acá la lista de columnas de cada tabla (la declara db/contract.yml en
// ba-aire/data).
const SQL = MEASUREMENTS.map(
  (m) => `
  SELECT '${m}' AS measurement, t."time", t.status,
         to_jsonb(t) - ARRAY['time', 'location', 'status', '_ingerido_en'] AS v
  FROM (
    SELECT * FROM bronze.${m}
    WHERE location = $1 AND "time" > now() - $2::interval
    ORDER BY "time" DESC
    LIMIT 1
  ) t`,
).join("\n  UNION ALL");

function latest(times: Array<Date | null>): Date | null {
  const valid = times.filter((t): t is Date => t !== null);
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid.map((t) => t.getTime())));
}

export async function fetchLastMinuteByLocation(location: Location) {
  const filas = await queryAiredb<Fila>(SQL, [location, VENTANA]);
  const por = new Map(filas.map((f) => [f.measurement, f]));
  const v = (m: Measurement, campo: string) => por.get(m)?.v[campo] ?? null;
  const status = (m: Measurement) => por.get(m)?.status ?? null;
  const time = (m: Measurement) => por.get(m)?.time ?? null;

  return FullLocationDataSchema.parse({
    location,
    timestamps: Object.fromEntries(MEASUREMENTS.map((m) => [m, time(m)])),
    latest_time: latest(MEASUREMENTS.map(time)),
    co_mean: v("co", "co"),
    co_mean_status: status("co"),
    no_mean: v("nox", "no"),
    no2_mean: v("nox", "no2"),
    nox_mean: v("nox", "nox"),
    nox_mean_status: status("nox"),
    o3_mean: v("o3", "o3"),
    o3_mean_status: status("o3"),
    so2_mean: v("so2", "so2"),
    so2_mean_status: status("so2"),
    pm10_mean: v("pm10", "pm10"),
    pm10_mean_status: status("pm10"),
    pm25_mean: v("pm25", "pm25"),
    pm25_mean_status: status("pm25"),
    dv_mean: v("meteo", "dv"),
    hr_in_mean: v("meteo", "hr_in"),
    hr_mean: v("meteo", "hr"),
    lluvia_mean: v("meteo", "lluvia"),
    temp_mean: v("meteo", "temp"),
    temp_in_mean: v("meteo", "temp_in"),
    vv_mean: v("meteo", "vv"),
    pa_mean: v("meteo", "pa"),
    rs_mean: v("meteo", "rs"),
    uv_mean: v("meteo", "uv"),
  });
}
