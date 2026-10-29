import { queryAiredb } from "@/db/airedb";
import type { Contaminant, Interval, Location } from "./models";
import {
  FUENTES_CRUDAS,
  type FuenteCruda,
  SUFIJO_STATUS,
  SUFIJO_VALIDADOS,
} from "./series";

// /datos desde airedb: silver (lo que paso, minuto a minuto y por hora) y gold
// (lo que se publica, con el 75 % aplicado: la horaria y las medias moviles de 8
// y 24 h). Reemplaza a las tablas minutales de InfluxDB.
//
// LA RESPUESTA CONSERVA LA FORMA DE SIEMPRE: una fila por instante, con `time` y
// una columna por serie ("centenario", "cordoba NO2", "cifa PM25"...), que es lo
// que dibujan el grafico y la tabla. Encima de eso agrega:
//   - por minuto: `<serie>@status`, el status del minuto en silver (ok, alarm,
//     zero, span, service, no_link, unknown). La UI filtra por status sin volver
//     a consultar.
//   - por hora: `<serie> (validados)`, lo que publica gold SOLO si la hora es
//     valida (>= 75 %), y las tres columnas crudas de silver (V14): `(crudo)`,
//     `(crudo con alarmas)` y `(crudo sin alarmas)`.
//   - por media movil de 8 o 24 h: solo `<serie> (validados)`. Silver no tiene
//     medias moviles. El punto va en el FINAL de la ventana: el de las 08:00 es
//     el promedio de 00:00 a 08:00, que es como se reportan las moviles. La
//     horaria, en cambio, va en el inicio de la hora (gold.window_start).
//
// NADA DE CORRIMIENTOS ACA. Con InfluxDB este archivo restaba un minuto (el
// timestamp marcaba el fin del minuto) y una hora mas al PM10 (el BAM1020 publica
// la hora anterior). En silver ts_minute ya es el INICIO del minuto, y el BAM lo
// corrige la horaria de ba-aire/data (V13). Corregirlo tambien aca lo correria
// dos veces.

/** Parametros de dim.parameters que forman cada opcion del selector, y el sufijo de su serie. */
const PARAMETROS: Record<
  Contaminant,
  Array<{ code: string; sufijo: string }>
> = {
  co: [{ code: "co", sufijo: "" }],
  no: [{ code: "no", sufijo: "" }],
  no2: [{ code: "no2", sufijo: "" }],
  nox: [
    { code: "no", sufijo: " NO" },
    { code: "no2", sufijo: " NO2" },
    { code: "nox", sufijo: " NOx" },
  ],
  pm10: [{ code: "pm10", sufijo: "" }],
  pm25: [{ code: "pm25", sufijo: "" }],
  pm1025: [
    { code: "pm10", sufijo: " PM10" },
    { code: "pm25", sufijo: " PM25" },
  ],
  o3: [{ code: "o3", sufijo: "" }],
  so2: [{ code: "so2", sufijo: "" }],
};

type Fila = {
  t: Date;
  station_code: string;
  parameter_code: string;
  // numeric llega como string desde pg (no pierde precision); se convierte al pivotear.
  value: string | number | null;
  status?: string;
  // Solo la horaria de silver: las tres columnas crudas (V14).
  value_raw?: string | number | null;
  value_con_alarma?: string | number | null;
};

/** Columna de silver.hourly_reading de cada fuente cruda. */
const COLUMNA_CRUDA: Record<
  FuenteCruda,
  "value_raw" | "value_con_alarma" | "value"
> = {
  crudo: "value_raw",
  conAlarmas: "value_con_alarma",
  sinAlarmas: "value",
};

// ---- Las consultas -----------------------------------------------------------
// Todas filtran por estaciones ($1), parametros ($2) y el rango [$3, $4). Los
// nombres de tabla y de vista son fijos: nada del request entra al SQL.

const MINUTOS = `
  SELECT m.ts_minute AS t, s.station_code, m.parameter_code, m.value, m.status
  FROM silver.minute_reading m
  JOIN dim.stations s USING (station_id)
  WHERE s.station_code = ANY($1) AND m.parameter_code = ANY($2)
    AND m.ts_minute >= $3 AND m.ts_minute < $4
  ORDER BY 1`;

// Las tres columnas crudas de la hora (V14): value_raw (todos los minutos),
// value_con_alarma (ok + alarma) y value (solo ok, lo que lee gold).
const HORAS_SILVER = `
  SELECT h.ts_hour AS t, s.station_code, h.parameter_code,
         h.value_raw, h.value_con_alarma, h.value
  FROM silver.hourly_reading h
  JOIN dim.stations s USING (station_id)
  WHERE s.station_code = ANY($1) AND h.parameter_code = ANY($2)
    AND h.ts_hour >= $3 AND h.ts_hour < $4
  ORDER BY 1`;

const HORAS_GOLD = `
  SELECT g.ts_hour AS t, s.station_code, g.parameter_code, g.value
  FROM gold.v_hourly g
  JOIN dim.stations s USING (station_id)
  WHERE s.station_code = ANY($1) AND g.parameter_code = ANY($2)
    AND g.ts_hour >= $3 AND g.ts_hour < $4
    AND g.is_valid
  ORDER BY 1`;

// Medias moviles de gold: una fila por hora, valida con >= 75 % de las horas. El
// punto va en el FINAL de la ventana (window_end), pero el filtro se hace por
// window_start, que es lo que indexa gold: window_end en [$3, $4) es lo mismo
// que window_start en [$3 - ventana, $4 - ventana). Vista y ventana son fijas:
// nada del request entra al SQL.
function consultaMovil(vista: "v_moving_8h" | "v_moving_24h", horas: 8 | 24) {
  return `
  SELECT g.window_end AS t, s.station_code, g.parameter_code, g.value
  FROM gold.${vista} g
  JOIN dim.stations s USING (station_id)
  WHERE s.station_code = ANY($1) AND g.parameter_code = ANY($2)
    AND g.window_start >= $3::timestamptz - INTERVAL '${horas} hours'
    AND g.window_start <  $4::timestamptz - INTERVAL '${horas} hours'
    AND g.is_valid
  ORDER BY 1`;
}
const MOVIL_8H = consultaMovil("v_moving_8h", 8);
const MOVIL_24H = consultaMovil("v_moving_24h", 24);

// Hasta donde proceso la horaria. Los jobs corren cada hora, asi que la ultima
// hora casi nunca esta: la UI lo avisa en vez de mostrar un hueco sin explicacion.
const PROCESADO_HASTA = `
  SELECT max(ts_hour) + INTERVAL '1 hour' AS hasta
  FROM silver.hourly_reading
  WHERE parameter_code = ANY($1)`;

// ---- El pivot ------------------------------------------------------------------

function aNumero(v: Fila["value"]): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Junta filas largas (instante, estacion, parametro) en filas anchas por instante. */
function pivotear(
  filas: Fila[],
  sufijoDe: Map<string, string>,
  extra: string,
  porTiempo: Map<string, Record<string, string | number | null>>,
  conStatus = false,
) {
  for (const f of filas) {
    const time = f.t.toISOString();
    let fila = porTiempo.get(time);
    if (!fila) {
      fila = { time };
      porTiempo.set(time, fila);
    }
    const serie = `${f.station_code}${sufijoDe.get(f.parameter_code) ?? ""}${extra}`;
    fila[serie] = aNumero(f.value);
    if (conStatus) fila[`${serie}${SUFIJO_STATUS}`] = f.status ?? null;
  }
}

export async function fetchDatosPorContaminante(params: {
  contaminant: Contaminant;
  locations: Location[];
  startDate: string;
  endDate: string;
  interval: Interval;
}) {
  const { contaminant, locations, startDate, endDate, interval } = params;
  const parametros = PARAMETROS[contaminant];
  const codes = parametros.map((p) => p.code);
  const sufijoDe = new Map(parametros.map((p) => [p.code, p.sufijo]));
  const args = [locations, codes, startDate, endDate];

  const porTiempo = new Map<string, Record<string, string | number | null>>();

  const procesado = queryAiredb<{ hasta: Date | null }>(PROCESADO_HASTA, [
    codes,
  ]);

  if (interval === "minute") {
    pivotear(
      await queryAiredb<Fila>(MINUTOS, args),
      sufijoDe,
      "",
      porTiempo,
      true,
    );
  } else if (interval === "hour") {
    const [silver, gold] = await Promise.all([
      queryAiredb<Fila>(HORAS_SILVER, args),
      queryAiredb<Fila>(HORAS_GOLD, args),
    ]);
    for (const fuente of FUENTES_CRUDAS) {
      const columna = COLUMNA_CRUDA[fuente.id];
      pivotear(
        silver.map((f) => ({ ...f, value: f[columna] ?? null })),
        sufijoDe,
        fuente.sufijo,
        porTiempo,
      );
    }
    pivotear(gold, sufijoDe, SUFIJO_VALIDADOS, porTiempo);
  } else {
    pivotear(
      await queryAiredb<Fila>(
        interval === "mov8h" ? MOVIL_8H : MOVIL_24H,
        args,
      ),
      sufijoDe,
      SUFIJO_VALIDADOS,
      porTiempo,
    );
  }

  const data = [...porTiempo.values()].sort((a, b) =>
    String(a.time).localeCompare(String(b.time)),
  );
  const [{ hasta } = { hasta: null }] = await procesado;

  return {
    data,
    meta: {
      contaminant,
      locations,
      startDate,
      endDate,
      interval,
      procesadoHasta: hasta ? hasta.toISOString() : null,
    },
  };
}
