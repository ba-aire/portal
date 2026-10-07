import { queryAiredb } from "@/db/airedb";
import type { Contaminant, Interval, Location } from "./models";
import { SUFIJO_GOLD, SUFIJO_STATUS } from "./series";

// /datos desde airedb: silver (lo que paso, minuto a minuto y por hora) y gold
// (lo que se publica, con el 75 % aplicado). Reemplaza a las tablas minutales de
// InfluxDB.
//
// LA RESPUESTA CONSERVA LA FORMA DE SIEMPRE: una fila por instante, con `time` y
// una columna por serie ("centenario", "cordoba NO2", "cifa PM25"...), que es lo
// que dibujan el grafico y la tabla. Encima de eso agrega:
//   - por minuto: `<serie>@status`, el status del minuto en silver (ok, alarm,
//     zero, span, service, no_link, unknown). La UI filtra por status sin volver
//     a consultar.
//   - por hora y por dia: `<serie> (gold)`, el valor que publica gold, SOLO si la
//     ventana es valida (>= 75 %). La serie sin sufijo es la de silver.
//
// NADA DE CORRIMIENTOS ACA. Con InfluxDB este archivo restaba un minuto (el
// timestamp marcaba el fin del minuto) y una hora mas al PM10 (el BAM1020 publica
// la hora anterior). En silver ts_minute ya es el INICIO del minuto, y el BAM lo
// corrige la horaria de ba-aire/data (V13). Corregirlo tambien aca lo correria
// dos veces.

const TZ = "America/Argentina/Buenos_Aires";

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

// Silver es el CRUDO: value_raw, todos los minutos con el status que sea (V14).
// value es el de gold (solo minutos K): leerlo aca dibujaria dos veces lo mismo.
const HORAS_SILVER = `
  SELECT h.ts_hour AS t, s.station_code, h.parameter_code, h.value_raw AS value
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

// El dia de silver es el promedio de sus horas, cortado en medianoche de Buenos
// Aires: el mismo bloque que usa gold.v_daily.
const DIAS_SILVER = `
  SELECT (date_trunc('day', h.ts_hour AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}') AS t,
         s.station_code, h.parameter_code, avg(h.value_raw) AS value
  FROM silver.hourly_reading h
  JOIN dim.stations s USING (station_id)
  WHERE s.station_code = ANY($1) AND h.parameter_code = ANY($2)
    AND h.ts_hour >= $3 AND h.ts_hour < $4
  GROUP BY 1, 2, 3
  ORDER BY 1`;

const DIAS_GOLD = `
  SELECT g.window_start AS t, s.station_code, g.parameter_code, g.value
  FROM gold.v_daily g
  JOIN dim.stations s USING (station_id)
  WHERE s.station_code = ANY($1) AND g.parameter_code = ANY($2)
    AND g.window_start >= $3 AND g.window_start < $4
    AND g.is_valid
  ORDER BY 1`;

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
  } else {
    const [silver, gold] = await Promise.all([
      queryAiredb<Fila>(interval === "hour" ? HORAS_SILVER : DIAS_SILVER, args),
      queryAiredb<Fila>(interval === "hour" ? HORAS_GOLD : DIAS_GOLD, args),
    ]);
    pivotear(silver, sufijoDe, "", porTiempo);
    pivotear(gold, sufijoDe, SUFIJO_GOLD, porTiempo);
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
