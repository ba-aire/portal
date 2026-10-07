/**
 * @file Las descargas desde airedb: silver (crudos) y gold (validados).
 * @description Reemplaza a las tablas minutales de InfluxDB. Devuelve una fila
 * ancha por instante con los mismos nombres de campo que armaba la versión de
 * InfluxDB, así el Excel no cambia de forma:
 *
 *   por hora    `<p>` validado (gold.v_hourly: solo minutos K), `<p>_raw` crudo
 *               (silver value_raw: todos los minutos), `<grupo>_status` los status
 *               observados en la hora, `<grupo>_k_status` los minutos K.
 *   por minuto  `<p>` el valor del minuto en silver, `<grupo>_status` su status.
 *   los dos     `dv_rumbo`, el rumbo de 16 puntos de la dirección (dim.rumbo).
 *
 * NADA DE CORRIMIENTOS NI CUENTAS ACÁ. Con InfluxDB este archivo devolvía el
 * PM10 del BAM1020 a su hora, tomaba la mediana y derivaba la lluvia horaria del
 * acumulador diario. Todo eso lo hace ahora ba-aire/data: el BAM en V13, y en
 * V14 la lluvia (suma de los incrementos), la dirección del viento (media
 * vectorial) y la exclusión de las alarmas en gold. Repetirlo acá lo aplicaría
 * dos veces.
 *
 * @author Ezequiel Maranda
 * @version 2.0.0
 * @since 2026-03-11
 */

import { queryAiredb } from "@/db/airedb";
import { DERIVED_COLUMNS, TABLE_CONFIG } from "./config";

// Los status de silver, con la letra de la convención de la red (la misma que
// emiten los drivers). `v` no aparece: silver la toma como K.
const LETRA_STATUS = `CASE m.status
    WHEN 'ok'      THEN 'K'
    WHEN 'alarm'   THEN 'A'
    WHEN 'zero'    THEN 'Z'
    WHEN 'span'    THEN 'S'
    WHEN 'service' THEN 'M'
    WHEN 'no_link' THEN 'C'
    ELSE '?'
  END`;

// h2s no existe en airedb: se pide nada y la columna queda vacía (s/d).
const GRUPOS = Object.entries(TABLE_CONFIG).filter(([g]) => g !== "h2s") as [
  string,
  { metrics: readonly string[] },
][];
const PARAMETROS = GRUPOS.flatMap(([, c]) => c.metrics);

// ---- Las columnas del pivot -------------------------------------------------
// Se arman con los nombres FIJOS de config.ts, no con nada del request: el SQL
// es siempre el mismo y los valores viajan como $1, $2, $3.

const sqlLit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const sqlId = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** El rumbo de 16 puntos (dim.rumbo) de la dirección del viento. */
const rumbo = (valor: string, parametro: string) =>
  `dim.rumbo(max(${valor}) FILTER (WHERE ${parametro} = 'dv')) AS ${sqlId(DERIVED_COLUMNS.dv)}`;

const COLUMNAS_HORA = [
  ...PARAMETROS.flatMap((p) => [
    `max(validado)  FILTER (WHERE parameter_code = ${sqlLit(p)}) AS ${sqlId(p)}`,
    `max(value_raw) FILTER (WHERE parameter_code = ${sqlLit(p)}) AS ${sqlId(`${p}_raw`)}`,
  ]),
  rumbo("value_raw", "parameter_code"),
  // Los parámetros de un grupo salen del mismo equipo y comparten los minutos:
  // max() es el del grupo.
  ...GRUPOS.map(
    ([g, c]) =>
      `max(n_minutes_valid) FILTER (WHERE parameter_code IN (${c.metrics.map(sqlLit).join(", ")})) AS ${sqlId(`${g}_k_status`)}`,
  ),
].join(",\n      ");

const COLUMNAS_STATUS_HORA = GRUPOS.map(
  ([g]) =>
    `string_agg(DISTINCT letra, ',' ORDER BY letra) FILTER (WHERE measurement = ${sqlLit(g)}) AS ${sqlId(`${g}_status`)}`,
).join(",\n      ");

const COLUMNAS_MINUTO = [
  ...PARAMETROS.map(
    (p) =>
      `max(m.value) FILTER (WHERE m.parameter_code = ${sqlLit(p)}) AS ${sqlId(p)}`,
  ),
  rumbo("m.value", "m.parameter_code"),
  ...GRUPOS.map(
    ([g]) =>
      `max(${LETRA_STATUS}) FILTER (WHERE p.measurement = ${sqlLit(g)}) AS ${sqlId(`${g}_status`)}`,
  ),
].join(",\n      ");

// ---- Las consultas -------------------------------------------------------------
// $1 estación, $2 desde, $3 hasta (excluido), $4 los parámetros de la descarga.

// Una hora de gold es la de silver con el 75 % aplicado: el LEFT JOIN la trae
// aunque sea inválida (gold publica el valor igual), y validados la resalta por
// el conteo de minutos K, que es el mismo criterio.
const HORAS = `
  WITH horas AS (
    SELECT h.ts_hour, h.parameter_code, h.value_raw, h.n_minutes_valid,
           g.value AS validado
    FROM silver.hourly_reading h
    JOIN dim.stations s USING (station_id)
    LEFT JOIN gold.v_hourly g
      ON g.station_id = h.station_id AND g.parameter_code = h.parameter_code
     AND g.ts_hour = h.ts_hour
    WHERE s.station_code = $1 AND h.ts_hour >= $2 AND h.ts_hour < $3
      AND h.parameter_code = ANY($4)
  ),

  -- Los status observados en cada hora. Un equipo que publica la hora anterior
  -- (BAM1020) lleva sus minutos a esa hora, igual que la horaria de silver (V13):
  -- si no, el status no seria el de los minutos que formaron el valor.
  minutos AS (
    SELECT date_trunc('hour', m.ts_minute)
             - CASE WHEN mo.publica_hora_anterior THEN INTERVAL '1 hour'
                    ELSE INTERVAL '0' END AS ts_hour,
           p.measurement,
           ${LETRA_STATUS} AS letra
    FROM silver.minute_reading m
    JOIN dim.stations s   USING (station_id)
    JOIN dim.parameters p USING (parameter_code)
    LEFT JOIN dim.instruments i ON i.instrument_id = m.instrument_id
    LEFT JOIN dim.models     mo ON mo.model_id     = i.model_id
    WHERE s.station_code = $1
      AND m.ts_minute >= $2 AND m.ts_minute < $3::timestamptz + INTERVAL '1 hour'
      AND m.parameter_code = ANY($4)
  ),

  status AS (
    SELECT ts_hour,
      ${COLUMNAS_STATUS_HORA}
    FROM minutos
    WHERE ts_hour >= $2 AND ts_hour < $3
    GROUP BY ts_hour
  ),

  valores AS (
    SELECT ts_hour,
      ${COLUMNAS_HORA}
    FROM horas
    GROUP BY ts_hour
  )

  SELECT v.ts_hour AS time, v.*, s.*
  FROM valores v
  LEFT JOIN status s USING (ts_hour)
  ORDER BY v.ts_hour`;

const MINUTOS = `
  SELECT m.ts_minute AS time,
      ${COLUMNAS_MINUTO}
  FROM silver.minute_reading m
  JOIN dim.stations s   USING (station_id)
  JOIN dim.parameters p USING (parameter_code)
  WHERE s.station_code = $1 AND m.ts_minute >= $2 AND m.ts_minute < $3
    AND m.parameter_code = ANY($4)
  GROUP BY m.ts_minute
  ORDER BY m.ts_minute`;

// ---- La respuesta ----------------------------------------------------------------

type Fila = Record<string, unknown>;

/**
 * pg devuelve numeric como string (para no perder precisión) y timestamptz como
 * Date. El Excel espera números y la fecha en ISO.
 */
function normalizar(fila: Fila): Record<string, string | number | null> {
  const salida: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(fila)) {
    if (k === "ts_hour") continue;
    if (v === null || v === undefined) {
      salida[k] = null;
    } else if (v instanceof Date) {
      salida[k] = v.toISOString();
    } else if (
      typeof v === "string" &&
      !k.endsWith("_status") &&
      !Object.values(DERIVED_COLUMNS).includes(k)
    ) {
      const n = Number(v);
      salida[k] = Number.isFinite(n) ? n : null;
    } else {
      salida[k] = v as string | number;
    }
  }
  return salida;
}

/**
 * Las filas de una estación entre dos instantes, por minuto o por hora.
 *
 * @param params location: código de la estación; startDate/endDate: ISO, el
 * hasta excluido; integration: "minute" o "hour".
 */
export async function fetchDatosPorEstacion(params: {
  location: string;
  startDate: string;
  endDate: string;
  integration: string;
}) {
  const { location, startDate, endDate, integration } = params;

  let sql: string;
  if (integration === "hour") {
    sql = HORAS;
  } else if (integration === "minute") {
    sql = MINUTOS;
  } else {
    throw new Error("Invalid integration");
  }

  const filas = await queryAiredb<Fila>(sql, [
    location,
    startDate,
    endDate,
    PARAMETROS,
  ]);

  return {
    data: filas.map(normalizar),
    meta: { location, startDate, endDate, integration },
  };
}

// Exportado para los tests: el SQL depende de la config, y un test lo afirma.
export const __sql = { HORAS, MINUTOS, PARAMETROS };
