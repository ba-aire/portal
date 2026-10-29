import { influx } from "@/db/influx";
import {
  type CoRow,
  FullLocationDataSchema,
  type MeteoRow,
  type NoxRow,
  type O3Row,
  type Pm10Row,
  type Pm25Row,
  type So2Row,
} from "./models";

// Función auxiliar para obtener el timestamp más reciente
function parseFlexibleTimestamp(ts: string | number | Date | null | undefined) {
  if (ts === null || ts === undefined) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === "number") {
    const abs = Math.abs(ts);
    const isMilliseconds = abs > 1e11 || ts.toString().length > 10;
    return isMilliseconds ? new Date(ts) : new Date(ts * 1000);
  }
  // string: try to parse as ISO or numeric string
  if (typeof ts === "string") {
    // numeric string?
    const num = Number(ts);
    if (!Number.isNaN(num)) {
      const abs = Math.abs(num);
      const isMilliseconds = abs > 1e11 || ts.length > 10;
      return isMilliseconds ? new Date(num) : new Date(num * 1000);
    }
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function getLatestTimestamp(
  timestamps: Array<string | number | Date | null | undefined>,
) {
  const parsed = timestamps
    .map((t) => parseFlexibleTimestamp(t))
    .filter((t): t is Date => t !== null);
  if (parsed.length === 0) return null;
  return new Date(Math.max(...parsed.map((d) => d.getTime())));
}

async function getFirstRow<T>(rows: AsyncIterable<T>): Promise<T | null> {
  for await (const row of rows) {
    return row;
  }
  return null;
}

export async function fetchLastMinuteByLocation(locationName: string) {
  const database = "minutales";

  // Query para CO
  const coQuery = `
      SELECT time, location, co_mean, status
      FROM co_minutales 
      WHERE location = '${locationName}'
      ORDER BY time DESC 
      LIMIT 1;
    `;

  // Query para NOx
  const noxQuery = `
      SELECT time, location, no2_mean, no_mean, nox_mean, status
      FROM nox_minutales 
      WHERE location = '${locationName}'
      ORDER BY time DESC 
      LIMIT 1;
    `;

  // Query para O3
  const o3Query = `
      SELECT time, location, o3_mean, status
      FROM o3_minutales 
      WHERE location = '${locationName}'
      ORDER BY time DESC 
      LIMIT 1;
    `;

  // Query para SO2
  const so2Query = `
      SELECT time, location, so2_mean, status
      FROM so2_minutales 
      WHERE location = '${locationName}'
      ORDER BY time DESC 
      LIMIT 1;
    `;

  // Query para PM10
  const pm10Query = `
      SELECT time, location, pm10_mean, status
      FROM pm10_minutales 
      WHERE location = '${locationName}'
      ORDER BY time DESC 
      LIMIT 1;
    `;

  // Query para PM2.5
  const pm25Query = `
      SELECT time, location, pm25_mean, status
      FROM pm25_minutales 
      WHERE location = '${locationName}'
      ORDER BY time DESC 
      LIMIT 1;
    `;

  // Query para Meteo
  const meteoQuery = `
      SELECT time, location, dv_mean, hr_in_mean, hr_mean, 
             lluvia_mean, temp_mean, temp_in_mean, vv_mean, pa_mean, rs_mean, uv_mean
      FROM meteo_minutales 
      WHERE location = '${locationName}'
      ORDER BY time DESC 
      LIMIT 1;
    `;

  try {
    // Ejecutar todas las queries en paralelo y manejar fallos individuales
    const results = await Promise.allSettled([
      getFirstRow<CoRow>(
        influx.query(coQuery, database) as AsyncIterable<CoRow>,
      ),
      getFirstRow<NoxRow>(
        influx.query(noxQuery, database) as AsyncIterable<NoxRow>,
      ),
      getFirstRow<O3Row>(
        influx.query(o3Query, database) as AsyncIterable<O3Row>,
      ),
      getFirstRow<So2Row>(
        influx.query(so2Query, database) as AsyncIterable<So2Row>,
      ),
      getFirstRow<Pm10Row>(
        influx.query(pm10Query, database) as AsyncIterable<Pm10Row>,
      ),
      getFirstRow<Pm25Row>(
        influx.query(pm25Query, database) as AsyncIterable<Pm25Row>,
      ),
      getFirstRow<MeteoRow>(
        influx.query(meteoQuery, database) as AsyncIterable<MeteoRow>,
      ),
    ]);

    const [coRes, noxRes, o3Res, so2Res, pm10Res, pm25Res, meteoRes] = results;

    const coRow = coRes.status === "fulfilled" ? coRes.value : null;
    if (coRes.status === "rejected") {
      console.error(`CO query failed for ${locationName}:`, coRes.reason);
    }

    const noxRow = noxRes.status === "fulfilled" ? noxRes.value : null;
    if (noxRes.status === "rejected") {
      console.error(`NOx query failed for ${locationName}:`, noxRes.reason);
    }

    const o3Row = o3Res.status === "fulfilled" ? o3Res.value : null;
    if (o3Res.status === "rejected") {
      console.error(`O3 query failed for ${locationName}:`, o3Res.reason);
    }

    const so2Row = so2Res.status === "fulfilled" ? so2Res.value : null;
    if (so2Res.status === "rejected") {
      console.error(`SO2 query failed for ${locationName}:`, so2Res.reason);
    }

    const pm10Row = pm10Res.status === "fulfilled" ? pm10Res.value : null;
    if (pm10Res.status === "rejected") {
      console.error(`PM10 query failed for ${locationName}:`, pm10Res.reason);
    }

    const pm25Row = pm25Res.status === "fulfilled" ? pm25Res.value : null;
    if (pm25Res.status === "rejected") {
      console.error(`PM2.5 query failed for ${locationName}:`, pm25Res.reason);
    }

    const meteoRow = meteoRes.status === "fulfilled" ? meteoRes.value : null;
    if (meteoRes.status === "rejected") {
      console.error(`Meteo query failed for ${locationName}:`, meteoRes.reason);
    }

    // Combinar los resultados
    const combinedData = {
      location: locationName,
      timestamps: {
        co: coRow?.time ?? null,
        nox: noxRow?.time ?? null,
        o3: o3Row?.time ?? null,
        so2: so2Row?.time ?? null,
        pm10: pm10Row?.time ?? null,
        pm25: pm25Row?.time ?? null,
        meteo: meteoRow?.time ?? null,
      },
      latest_time: getLatestTimestamp([
        coRow?.time,
        noxRow?.time,
        o3Row?.time,
        so2Row?.time,
        pm10Row?.time,
        pm25Row?.time,
        meteoRow?.time,
      ]),
      // CO data
      co_mean: coRow?.co_mean ?? null,
      co_mean_status: coRow?.status ?? null,
      // NOx data
      no_mean: noxRow?.no_mean ?? null,
      no2_mean: noxRow?.no2_mean ?? null,
      nox_mean: noxRow?.nox_mean ?? null,
      nox_mean_status: noxRow?.status ?? null,
      // O3 data
      o3_mean: o3Row?.o3_mean ?? null,
      o3_mean_status: o3Row?.status ?? null,
      // SO2 data
      so2_mean: so2Row?.so2_mean ?? null,
      so2_mean_status: so2Row?.status ?? null,
      // PM10 data
      pm10_mean: pm10Row?.pm10_mean ?? null,
      pm10_mean_status: pm10Row?.status ?? null,
      // PM2.5 data
      pm25_mean: pm25Row?.pm25_mean ?? null,
      pm25_mean_status: pm25Row?.status ?? null,
      // Meteo data
      dv_mean: meteoRow?.dv_mean ?? null,
      hr_in_mean: meteoRow?.hr_in_mean ?? null,
      hr_mean: meteoRow?.hr_mean ?? null,
      lluvia_mean: meteoRow?.lluvia_mean ?? null,
      temp_mean: meteoRow?.temp_mean ?? null,
      temp_in_mean: meteoRow?.temp_in_mean ?? null,
      vv_mean: meteoRow?.vv_mean ?? null,
      pa_mean: meteoRow?.pa_mean ?? null,
      rs_mean: meteoRow?.rs_mean ?? null,
      uv_mean: meteoRow?.uv_mean ?? null,
    };

    return FullLocationDataSchema.parse(combinedData);
  } catch (error) {
    console.error(`Error fetching data for location ${locationName}:`, error);
    throw error;
  }
}
