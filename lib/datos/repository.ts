import { influx } from "@/db/influx";

// CONSULTA DATOS DE INFLUXDB CON PARÁMETROS DINÁMICOS
export async function fetchDatosPorContaminante(params: {
  contaminant: string;
  locations: string[];
  startDate: string;
  endDate: string;
  interval: string;
}) {
  const database = "minutales";
  const { contaminant, locations, startDate, endDate, interval } = params;

  // En las tablas minutales el timestamp marca el FIN del minuto: el registro
  // de 12:00 corresponde al muestreo 11:59-12:00, por lo que pertenece al
  // promedio horario 11-12, no al 12-13. Restamos 1 min antes de truncar
  // para alinear el bucket. No aplica a interval "minute" (cada registro es
  // su propio bucket).
  const DEFAULT_TIME_EXPR =
    interval === "minute" ? "time" : "time - INTERVAL '1 minute'";

  // PM10 además: el analizador muestrea durante una hora y entrega el valor
  // en la hora posterior, así que se resta 1h adicional sobre el shift minutal.
  const PM10_TIME_EXPR = `${DEFAULT_TIME_EXPR} - INTERVAL '1 hour'`;

  const runQuery = async (query: string) => {
    const rows: Record<string, string | number>[] = [];
    for await (const row of influx.query(query, database)) {
      rows.push(row as Record<string, string | number>);
    }
    return rows;
  };

  const buildQuery = (
    table: string,
    selects: string,
    timeExpr: string = DEFAULT_TIME_EXPR,
  ) => `
  SELECT
  DATE_TRUNC('${interval}', ${timeExpr}) AS time,
  ${selects}
  FROM ${table}
  WHERE time >= '${startDate}'
  AND time < '${endDate}'
  GROUP BY DATE_TRUNC('${interval}', ${timeExpr})
  ORDER BY time;
  `;

  // Filtra filas cuyo bucket quedó antes del startDate tras los shifts
  // (pm10 -1h, o minute-level -1m en el borde del rango: el registro de
  // startDate 00:00 cae en el bucket 23:xx del día anterior).
  const startMs = new Date(startDate).getTime();
  const isInWindow = (row: Record<string, string | number>) => {
    const t =
      typeof row.time === "number"
        ? row.time
        : new Date(String(row.time)).getTime();
    return Number.isFinite(t) && t >= startMs;
  };

  try {
    // PM10 y PM2.5 viven en tablas distintas: corremos dos queries en paralelo
    // y mergeamos por time para devolver un único dataset.
    if (contaminant === "pm1025") {
      const pm10Selects = locations
        .map(
          (location) =>
            `AVG(CASE WHEN LOWER(TRIM(location)) = LOWER(TRIM('${location}')) THEN pm10_mean END) AS "${location} PM10"`,
        )
        .join(",\n  ");
      const pm25Selects = locations
        .map(
          (location) =>
            `AVG(CASE WHEN LOWER(TRIM(location)) = LOWER(TRIM('${location}')) THEN pm25_mean END) AS "${location} PM25"`,
        )
        .join(",\n  ");

      const [pm10Rows, pm25Rows] = await Promise.all([
        runQuery(buildQuery("pm10_minutales", pm10Selects, PM10_TIME_EXPR)),
        runQuery(buildQuery("pm25_minutales", pm25Selects)),
      ]);

      const mergedByTime = new Map<string, Record<string, string | number>>();
      for (const row of [
        ...pm10Rows.filter(isInWindow),
        ...pm25Rows.filter(isInWindow),
      ]) {
        const time = String(row.time);
        const existing = mergedByTime.get(time);
        mergedByTime.set(time, existing ? { ...existing, ...row } : { ...row });
      }
      const data = Array.from(mergedByTime.values()).sort((a, b) =>
        String(a.time).localeCompare(String(b.time)),
      );

      return {
        data,
        meta: { contaminant, locations, startDate, endDate, interval },
      };
    }

    const tableMap: Record<string, string> = {
      co: "co_minutales",
      no2: "nox_minutales",
      no: "nox_minutales",
      nox: "nox_minutales",
      pm10: "pm10_minutales",
      pm25: "pm25_minutales",
      o3: "o3_minutales",
      so2: "so2_minutales",
    };
    const table = tableMap[contaminant] || "co_minutales";

    const columnMap: Record<string, string> = {
      co: "co_mean",
      no2: "no2_mean",
      no: "no_mean",
      nox: "nox_mean",
      pm10: "pm10_mean",
      pm25: "pm25_mean",
      o3: "o3_mean",
      so2: "so2_mean",
    };
    const column = columnMap[contaminant] || "co_mean";

    let locationSelects: string;
    if (column === "nox_mean") {
      locationSelects = locations
        .map(
          (location) =>
            `AVG(CASE WHEN LOWER(TRIM(location)) = LOWER(TRIM('${location}')) THEN no2_mean END) AS "${location} NO2",
          AVG(CASE WHEN LOWER(TRIM(location)) = LOWER(TRIM('${location}')) THEN no_mean END) AS "${location} NO",
          AVG(CASE WHEN LOWER(TRIM(location)) = LOWER(TRIM('${location}')) THEN nox_mean END) AS "${location} NOx"`,
        )
        .join(",\n  ");
    } else {
      locationSelects = locations
        .map(
          (location) =>
            `AVG(CASE WHEN LOWER(TRIM(location)) = LOWER(TRIM('${location}')) THEN ${column} END) AS "${location}"`,
        )
        .join(",\n  ");
    }

    const timeExpr =
      contaminant === "pm10" ? PM10_TIME_EXPR : DEFAULT_TIME_EXPR;
    const rows = await runQuery(buildQuery(table, locationSelects, timeExpr));
    const filtered = rows.filter(isInWindow);
    return {
      data: filtered,
      meta: { contaminant, locations, startDate, endDate, interval },
    };
  } catch (error) {
    console.error("Error in fetchDatosPorContaminante:", error);
    throw error;
  }
}
