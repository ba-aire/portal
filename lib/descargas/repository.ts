/**
 * @file Repositorio para la consulta de datos desde InfluxDB.
 * @description Maneja las consultas dinámicas a InfluxDB3 para diferentes contaminantes y meteorología,
 * realizando la unificación de datos basada en el tiempo y ajustes específicos de sensores.
 * @author Ezequiel Maranda
 * @version 1.4.0
 * @since 2026-03-11
 */

import { influx } from "@/db/influx";
import { TABLE_CONFIG } from "./config";

/**
 * Función auxiliar para recolectar todas las filas de un iterable asíncrono.
 * @param iterable El flujo de datos asíncrono desde InfluxDB.
 * @returns Un array con todos los registros obtenidos.
 */
// Helper function to collect all rows from an async iterable
async function collectRows<T>(iterable: AsyncIterable<T>): Promise<Array<T>> {
  const rows: Array<T> = [];
  for await (const row of iterable) {
    rows.push(row);
  }
  return rows;
}

// Estaciones donde el pm10 se mide con un MetOne BAM1020. El equipo mide una
// hora completa y publica ese único promedio, repetido minuto a minuto,
// durante la hora siguiente.
const BAM1020_LOCATIONS = new Set(["cordoba", "catalinas", "centenario"]);

const HOUR_MS = 60 * 60 * 1000;

// Argentina no tiene horario de verano: el offset UTC-3 es fijo todo el año.
const ARGENTINA_UTC_OFFSET_HOURS = -3;

/** Hora local argentina (0-23) de un timestamp en milisegundos. */
function argentinaHour(timeMs: number): number {
  return (
    (new Date(timeMs).getUTCHours() + 24 + ARGENTINA_UTC_OFFSET_HOURS) % 24
  );
}

/**
 * Deriva la lluvia caída en cada hora a partir del acumulador del pluviómetro.
 *
 * El equipo no informa lluvia por minuto sino un acumulador que resetea a las
 * 00:00 hora argentina, así que el MAX horario que trae la query es "lo
 * acumulado del día al cierre de la hora". La lluvia de la hora es la
 * diferencia contra la hora anterior contigua, con dos excepciones: en la
 * primera hora del día local el acumulador arrancó de cero y el valor se usa
 * directo, y un descenso a mitad del día sólo puede ser un reset, así que
 * también se usa directo. Sin hora anterior contigua la diferencia acumula
 * varias horas y no es atribuible a una sola, por lo que queda sin dato.
 *
 * @param rows Filas horarias ya unificadas y ordenadas cronológicamente.
 */
function deriveHourlyRain(rows: Array<Record<string, string | number | null>>) {
  const series = ["lluvia", "lluvia_raw"] as const;
  const previous: Record<
    (typeof series)[number],
    { timeMs: number; acum: number } | undefined
  > = {
    lluvia: undefined,
    lluvia_raw: undefined,
  };

  for (const row of rows) {
    const timeMs = new Date(String(row.time)).getTime();
    for (const field of series) {
      const acum = row[field];
      if (typeof acum !== "number") {
        continue;
      }
      const prev = previous[field];
      previous[field] = { timeMs, acum };

      if (argentinaHour(timeMs) === 0) {
        // Primera hora del día local: el acumulador arrancó de cero a las 00:00
        row[field] = acum;
      } else if (prev && timeMs - prev.timeMs === HOUR_MS) {
        const delta = acum - prev.acum;
        row[field] = delta >= 0 ? delta : acum;
      } else {
        row[field] = null;
      }
    }
  }
}

/**
 * Consulta y unifica datos de múltiples tablas de InfluxDB para una estación específica.
 *
 * @param params Objetos con los parámetros de búsqueda:
 * - location: ID de la estación.
 * - startDate: Fecha de inicio (ISO).
 * - endDate: Fecha de fin (ISO).
 * - integration: Tipo de promedio ("hour" o "minute").
 *
 * Para la integración horaria cada tabla aporta dos series: la cruda
 * (`{metrica}_raw`, promedio de todos los minutos sin importar el status, con
 * los status observados en `{tabla}_status`) y la validada (`{metrica}`,
 * promedio sólo de los minutos con status 'k', con el conteo de minutos
 * válidos en `{tabla}_k_status`). La lluvia horaria no es un promedio: se
 * deriva del acumulador diario del pluviómetro (ver deriveHourlyRain). El
 * pm10 medido con BAM1020 se agrega con la mediana y no expone conteo de
 * minutos k, porque el equipo entrega una única medición por hora.
 *
 * @returns Objeto con los datos unificados y ordenados cronológicamente.
 */
export async function fetchDatosPorEstacion(params: {
  location: string;
  startDate: string;
  endDate: string;
  integration: string;
}) {
  const database = "minutales";
  const { location, startDate, endDate, integration } = params;

  // Build queries for each table
  const queries = Object.entries(TABLE_CONFIG).map(([key, config]) => {
    const { table, metrics } = config;

    let query: string;
    if (integration === "hour") {
      // El pm10 del BAM1020 no es minutal: los minutos repiten el único
      // promedio horario del equipo. La mediana recupera ese valor repetido
      // sin que los minutos de transición entre horas lo muevan, cosa que el
      // promedio sí haría.
      const isBamPm10 = key === "pm10" && BAM1020_LOCATIONS.has(location);

      // La lluvia no se promedia: el pluviómetro informa un acumulador diario,
      // así que el MAX es "lo acumulado al cierre de la hora" y después
      // deriveHourlyRain lo convierte en lluvia caída por hora.
      const aggregatorFor = (metric: string) => {
        if (metric === "lluvia_mean") return "MAX";
        if (isBamPm10) return "MEDIAN";
        return "AVG";
      };

      // Serie cruda: agregado horario de todos los minutos, sin importar el status.
      const rawSelect = metrics
        .map((metric) => {
          const name = metric.replace("_mean", "");
          return `${aggregatorFor(metric)}(${metric}) AS ${name}_raw`;
        })
        .join(", ");

      // Serie validada: sólo entran los minutos con status 'k'.
      const validatedSelect = metrics
        .map((metric) => {
          const name = metric.replace("_mean", "");
          return `${aggregatorFor(metric)}(CASE WHEN status = 'k' THEN ${metric} END) AS ${name}`;
        })
        .join(", ");

      // El conteo de minutos k no aplica al BAM1020: con una sola medición
      // real por hora no dice nada del respaldo del dato, y dispararía el
      // resaltado del 75% en la hoja de validados.
      const kCountSelect = isBamPm10
        ? ""
        : `,
        COUNT(CASE WHEN status = 'k' THEN 1 END) AS ${key}_k_status`;

      query = `
      SELECT
        DATE_BIN('1 hour', time - INTERVAL '1 minute', '1970-01-01') AS time,
        location,
        ${validatedSelect},
        ${rawSelect},
        array_to_string(array_agg(DISTINCT status), ',') AS ${key}_status${kCountSelect}
      FROM ${table}
      WHERE location = '${location}'
        AND (time - INTERVAL '1 minute') >= '${startDate}'
        AND (time - INTERVAL '1 minute') < '${endDate}'
      GROUP BY DATE_BIN('1 hour', time - INTERVAL '1 minute', '1970-01-01'), location
      ORDER BY time ASC
    `;
    } else if (integration === "minute") {
      // Para datos minutales, agrupar por minuto truncado con prioridad de status
      // Para integración por minuto, seleccionar directamente sin filtrado por status
      // Asumiendo que los datos están limpios y hay máximo un registro por minuto
      const metricsSelect = metrics
        .map((metric) => `${metric} AS ${metric.replace("_mean", "")}`)
        .join(", ");

      query = `
        SELECT
          DATE_BIN('1 minute', time, '1970-01-01') AS time,
          location,
          ${metricsSelect},
          status AS ${key}_status
        FROM ${table}
        WHERE location = '${location}'
          AND time >= '${startDate}'
          AND time < '${endDate}'
        ORDER BY time ASC
      `;
    } else {
      throw new Error("Invalid integration");
    }

    return { key, query, table };
  });

  try {
    // Execute all queries in parallel
    const results = await Promise.allSettled(
      queries.map(async ({ key, query, table }) => {
        try {
          const rows = await collectRows(
            influx.query(query, database) as AsyncIterable<
              Record<string, string | number>
            >,
          );
          return { key, rows, success: true };
        } catch (error) {
          console.error(`Error querying ${table} for ${location}:`, error);
          return { key, rows: [], success: false, error };
        }
      }),
    );

    // rowMap se utiliza para unificar las métricas de diferentes tablas (CO, NOx, etc.)
    // que corresponden al mismo instante de tiempo en una única fila.
    const rowMap = new Map<string, Record<string, string | number>>();

    // Recorremos los resultados de las consultas (una por cada tabla en TABLE_CONFIG)
    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value.success) {
        const { key, rows } = result.value;

        // Procesamos cada registro individual de la tabla actual
        rows.forEach((row) => {
          // Convertir el timestamp a milisegundos de forma confiable
          let timeMs: number;
          if (typeof row.time === "number") {
            timeMs = row.time;
          } else {
            timeMs = new Date(String(row.time || "")).getTime();
          }

          // Restamos 1 hora para el pm10 medido con BAM1020: el equipo mide
          // durante una hora y muestra el resultado durante la hora siguiente,
          // así que el valor hay que devolverlo a la hora que midió.
          if (key === "pm10" && BAM1020_LOCATIONS.has(location)) {
            timeMs -= HOUR_MS;
          }

          // Si después del ajuste el registro cae antes del startDate pedido, lo descartamos.
          // Esto ocurre cuando el primer registro del día (00:00) baja a las 23:xx del día anterior.
          if (timeMs < new Date(startDate).getTime()) {
            return;
          }

          // Convertir timestamp de milisegundos a ISO string para tener la key unificada
          const timeISO = new Date(Math.round(timeMs)).toISOString();

          // Buscamos si ya existe una fila para este timestamp en el mapa de unión
          const timeKey = timeISO;
          const existingRow = rowMap.get(timeKey);

          if (existingRow) {
            // Unificamos: agregamos las nuevas métricas al objeto existente en el mapa
            // Object.assign muta el objeto por referencia, actualizando el valor en el Map
            Object.assign(existingRow, row);
            existingRow.time = timeISO;
          } else {
            // Primera vez que vemos este horario: creamos un nuevo registro base
            const newRow: Record<string, string | number> = {
              ...row,
              time: timeISO,
              location: row.location || location,
            };
            rowMap.set(timeKey, newRow);
          }
        });
      } else if (result.status === "rejected") {
        console.error(`Query ${queries[index].key} failed:`, result.reason);
      }
    });

    // Convert map to array and sort by time
    const sortedRows = Array.from(rowMap.values()).sort((a, b) => {
      const timeA = new Date(String(a.time)).getTime();
      const timeB = new Date(String(b.time)).getTime();
      return timeA - timeB;
    });

    // Sólo horas cerradas: a las 14:35 el bin 14:00 (cubre 14:01-15:00) se
    // sigue midiendo y su promedio cambiaría con cada minuto. Se filtra acá y
    // no en el WHERE de la query porque el corrimiento del BAM1020 ya ubicó el
    // pm10 de la hora en curso en la hora anterior, que sí está cerrada.
    const completedRows =
      integration === "hour"
        ? sortedRows.filter(
            (row) =>
              new Date(String(row.time)).getTime() + HOUR_MS <= Date.now(),
          )
        : sortedRows;

    // La lluvia horaria se deriva recién acá porque necesita la serie completa
    // ordenada: el cálculo compara cada hora con la anterior contigua.
    if (integration === "hour") {
      deriveHourlyRain(completedRows);
    }

    return {
      data: completedRows,
      meta: {
        location,
        startDate,
        endDate,
        integration,
      },
    };
  } catch (error) {
    console.error("Error in fetchDatosPorEstacion:", error);
    throw error;
  }
}
