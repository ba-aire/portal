// @vitest-environment node
//
// Mismo enfoque que el repositorio de datos: se intercepta el cliente de
// InfluxDB y se afirma sobre el SQL generado y sobre la unificación de filas.
// Acá hay además dos comportamientos que sólo se ven en el resultado y no en
// la query: el corrimiento del BAM1020 —que depende de la estación— y la
// tolerancia a que una tabla falle sin arrastrar a las demás.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Fila = Record<string, string | number>;

const { influx, state } = vi.hoisted(() => {
  const state = {
    queries: [] as string[],
    responder: (_sql: string): Fila[] => [],
  };

  const influx = {
    query: (sql: string, _database: string) => {
      state.queries.push(sql);
      const filas = state.responder(sql);
      return (async function* () {
        for (const fila of filas) yield fila;
      })();
    },
  };

  return { influx, state };
});

vi.mock("@/db/influx", () => ({ influx }));

import { TABLE_CONFIG } from "@/lib/descargas/config";
import { fetchDatosPorEstacion } from "@/lib/descargas/repository";

function queries(): string[] {
  return state.queries.map((q) => q.replace(/\s+/g, " ").trim());
}

/** Query emitida contra una tabla puntual. */
function queryDe(tabla: string): string {
  const q = queries().find((s) => s.includes(`FROM ${tabla}`));
  if (!q) throw new Error(`No se emitió query contra ${tabla}`);
  return q;
}

const PARAMS_BASE = {
  location: "cifa",
  startDate: "2026-01-01T00:00:00Z",
  endDate: "2026-01-02T00:00:00Z",
  integration: "hour",
};

describe("fetchDatosPorEstacion", () => {
  beforeEach(() => {
    state.queries = [];
    state.responder = () => [];
  });

  it("consulta todas las tablas configuradas", async () => {
    await fetchDatosPorEstacion(PARAMS_BASE);

    // Una query por tabla de TABLE_CONFIG: si se agrega un contaminante nuevo
    // a la config y el repositorio deja de recorrerla, esto lo marca.
    expect(state.queries).toHaveLength(Object.keys(TABLE_CONFIG).length);
    for (const { table } of Object.values(TABLE_CONFIG)) {
      expect(queries().some((q) => q.includes(`FROM ${table}`))).toBe(true);
    }
  });

  describe("integración horaria", () => {
    it("agrupa en bins de una hora corriendo el minuto de cierre", async () => {
      await fetchDatosPorEstacion(PARAMS_BASE);

      expect(queryDe("co_minutales")).toContain(
        "DATE_BIN('1 hour', time - INTERVAL '1 minute', '1970-01-01')",
      );
    });

    // La hoja de crudos necesita el promedio de todos los minutos: el filtro
    // por status vive en un CASE del agregado validado, no en el WHERE.
    it("promedia todos los minutos en la serie cruda sin filtrar por status", async () => {
      await fetchDatosPorEstacion(PARAMS_BASE);

      const co = queryDe("co_minutales");
      expect(co).toContain("AVG(co_mean) AS co_raw");
      expect(co).not.toContain("AND status = 'k'");
    });

    // El promedio validado sólo debe construirse con minutos con status k. Sin
    // esto, un minuto marcado como inválido contamina toda la hora.
    it("promedia únicamente los minutos con status k en la serie validada", async () => {
      await fetchDatosPorEstacion(PARAMS_BASE);

      expect(queryDe("co_minutales")).toContain(
        "AVG(CASE WHEN status = 'k' THEN co_mean END) AS co",
      );
    });

    it("expone cuántos minutos válidos respaldan cada hora", async () => {
      await fetchDatosPorEstacion(PARAMS_BASE);

      // El conteo es lo que permite descartar (y resaltar en el Excel) las
      // horas armadas con menos del 75% de los minutos.
      expect(queryDe("co_minutales")).toContain(
        "COUNT(CASE WHEN status = 'k' THEN 1 END) AS co_k_status",
      );
    });

    // La hoja de crudos muestra qué status hubo en cada hora: es lo que
    // explica por qué el promedio validado difiere del crudo.
    it("lista los status observados en cada hora", async () => {
      await fetchDatosPorEstacion(PARAMS_BASE);

      expect(queryDe("co_minutales")).toContain(
        "array_to_string(array_agg(DISTINCT status), ',') AS co_status",
      );
    });

    // La lluvia es acumulada: promediarla da un número sin sentido físico.
    it("acumula la lluvia con MAX y promedia el resto de lo meteorológico", async () => {
      await fetchDatosPorEstacion(PARAMS_BASE);

      const meteo = queryDe("meteo_minutales");
      expect(meteo).toContain("MAX(lluvia_mean) AS lluvia_raw");
      expect(meteo).toContain(
        "MAX(CASE WHEN status = 'k' THEN lluvia_mean END) AS lluvia",
      );
      expect(meteo).toContain("AVG(temp_mean) AS temp_raw");
      expect(meteo).not.toContain("AVG(lluvia_mean)");
    });
  });

  describe("integración minutal", () => {
    it("agrupa en bins de un minuto sin corrimiento", async () => {
      await fetchDatosPorEstacion({ ...PARAMS_BASE, integration: "minute" });

      expect(queryDe("co_minutales")).toContain(
        "DATE_BIN('1 minute', time, '1970-01-01')",
      );
    });

    // A nivel minutal no se promedia nada, así que no hay razón para descartar
    // filas: se devuelve el status y que el usuario decida.
    it("no filtra por status y lo devuelve como columna", async () => {
      await fetchDatosPorEstacion({ ...PARAMS_BASE, integration: "minute" });

      const co = queryDe("co_minutales");
      expect(co).not.toContain("status = 'k'");
      expect(co).toContain("status AS co_status");
    });
  });

  it("rechaza una integración desconocida", async () => {
    await expect(
      fetchDatosPorEstacion({ ...PARAMS_BASE, integration: "semana" }),
    ).rejects.toThrow("Invalid integration");
  });

  describe("pm10 del BAM1020", () => {
    // El BAM entrega un único promedio por hora, repetido en cada minuto: la
    // mediana recupera ese valor sin que los minutos de transición entre una
    // hora y la siguiente muevan el resultado, como pasaría con el promedio.
    it("agrega el pm10 con la mediana en las estaciones con BAM1020", async () => {
      await fetchDatosPorEstacion({ ...PARAMS_BASE, location: "cordoba" });

      const pm10 = queryDe("pm10_minutales");
      expect(pm10).toContain("MEDIAN(pm10_mean) AS pm10_raw");
      expect(pm10).toContain(
        "MEDIAN(CASE WHEN status = 'k' THEN pm10_mean END) AS pm10",
      );
      expect(pm10).not.toContain("AVG(pm10_mean)");
    });

    it("mantiene el promedio de pm10 en las estaciones sin BAM1020", async () => {
      await fetchDatosPorEstacion(PARAMS_BASE);

      const pm10 = queryDe("pm10_minutales");
      expect(pm10).toContain("AVG(pm10_mean) AS pm10_raw");
      expect(pm10).not.toContain("MEDIAN");
    });

    // Con una sola medición real por hora, contar minutos con status k no
    // dice nada del respaldo del dato y dispararía el resaltado del 75%.
    it("no expone el conteo de minutos k en las estaciones con BAM1020", async () => {
      await fetchDatosPorEstacion({ ...PARAMS_BASE, location: "cordoba" });

      const pm10 = queryDe("pm10_minutales");
      expect(pm10).not.toContain("pm10_k_status");
      expect(pm10).toContain("AS pm10_status");
    });

    it("mantiene el conteo de minutos k en las estaciones sin BAM1020", async () => {
      await fetchDatosPorEstacion(PARAMS_BASE);

      expect(queryDe("pm10_minutales")).toContain("AS pm10_k_status");
    });

    it("no cambia la descarga minutal, que entrega lo que hay en la base", async () => {
      await fetchDatosPorEstacion({
        ...PARAMS_BASE,
        location: "cordoba",
        integration: "minute",
      });

      const pm10 = queryDe("pm10_minutales");
      expect(pm10).toContain("pm10_mean AS pm10");
      expect(pm10).not.toContain("MEDIAN");
    });
  });

  describe("corrimiento del BAM1020 en pm10", () => {
    // El equipo mide durante una hora y publica el resultado en la hora
    // siguiente, así que el valor hay que devolverlo a la hora que midió. Sólo
    // aplica donde está instalado ese analizador.
    it("retrasa una hora el pm10 en las estaciones con BAM1020", async () => {
      state.responder = (sql) =>
        sql.includes("pm10_minutales")
          ? [{ time: "2026-01-01T10:00:00Z", pm10: 42 }]
          : [];

      const { data } = await fetchDatosPorEstacion({
        ...PARAMS_BASE,
        location: "cordoba",
      });

      expect(data[0].time).toBe("2026-01-01T09:00:00.000Z");
    });

    it("no toca el pm10 de las estaciones sin BAM1020", async () => {
      state.responder = (sql) =>
        sql.includes("pm10_minutales")
          ? [{ time: "2026-01-01T10:00:00Z", pm10: 42 }]
          : [];

      const { data } = await fetchDatosPorEstacion({
        ...PARAMS_BASE,
        location: "cifa",
      });

      expect(data[0].time).toBe("2026-01-01T10:00:00.000Z");
    });

    it("descarta el registro que el corrimiento saca de la ventana pedida", async () => {
      // El primero del día baja a las 23:xx del día anterior: queda fuera del
      // rango que el usuario pidió y devolverlo sería un dato de más.
      state.responder = (sql) =>
        sql.includes("pm10_minutales")
          ? [{ time: "2026-01-01T00:00:00Z", pm10: 42 }]
          : [];

      const { data } = await fetchDatosPorEstacion({
        ...PARAMS_BASE,
        location: "cordoba",
      });

      expect(data).toHaveLength(0);
    });
  });

  describe("horas incompletas", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    /** Fija el "ahora" del repositorio en un instante conocido. */
    function ahoraEs(iso: string) {
      vi.spyOn(Date, "now").mockReturnValue(new Date(iso).getTime());
    }

    // A las 14:35 el bin 14:00 (cubre 14:01-15:00) se sigue midiendo: su
    // promedio es provisorio y cambiaría con cada minuto que pasa.
    it("descarta el bin de la hora en curso", async () => {
      ahoraEs("2026-01-01T14:35:00Z");
      state.responder = (sql) =>
        sql.includes("co_minutales")
          ? [
              { time: "2026-01-01T13:00:00Z", co: 1 },
              { time: "2026-01-01T14:00:00Z", co: 2 },
            ]
          : [];

      const { data } = await fetchDatosPorEstacion(PARAMS_BASE);

      expect(data.map((f) => f.time)).toEqual(["2026-01-01T13:00:00.000Z"]);
    });

    it("conserva el bin que cierra exactamente ahora", async () => {
      // A las 15:00 en punto el bin 14:00 ya recibió su último minuto.
      ahoraEs("2026-01-01T15:00:00Z");
      state.responder = (sql) =>
        sql.includes("co_minutales")
          ? [{ time: "2026-01-01T14:00:00Z", co: 2 }]
          : [];

      const { data } = await fetchDatosPorEstacion(PARAMS_BASE);

      expect(data).toHaveLength(1);
    });

    // El BAM1020 publica durante la hora en curso lo que midió en la hora
    // anterior: tras el corrimiento ese dato pertenece a una hora ya cerrada,
    // y filtrarlo en la query lo haría desaparecer del archivo.
    it("no descarta el pm10 corrido del BAM1020", async () => {
      ahoraEs("2026-01-01T14:35:00Z");
      state.responder = (sql) =>
        sql.includes("pm10_minutales")
          ? [{ time: "2026-01-01T14:00:00Z", pm10: 42 }]
          : [];

      const { data } = await fetchDatosPorEstacion({
        ...PARAMS_BASE,
        location: "cordoba",
      });

      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        time: "2026-01-01T13:00:00.000Z",
        pm10: 42,
      });
    });

    it("no filtra la integración minutal", async () => {
      // El minuto ya registrado está completo por definición.
      ahoraEs("2026-01-01T14:35:00Z");
      state.responder = (sql) =>
        sql.includes("co_minutales")
          ? [{ time: "2026-01-01T14:34:00Z", co: 1 }]
          : [];

      const { data } = await fetchDatosPorEstacion({
        ...PARAMS_BASE,
        integration: "minute",
      });

      expect(data).toHaveLength(1);
    });
  });

  describe("lluvia horaria derivada del acumulador", () => {
    // El pluviómetro no mide lluvia por minuto: informa un acumulador que
    // resetea a las 00:00 hora argentina (03:00 UTC). La lluvia de la hora es
    // la diferencia contra la hora anterior, no el valor del acumulador.
    it("convierte el acumulador en lluvia caída por hora", async () => {
      state.responder = (sql) =>
        sql.includes("meteo_minutales")
          ? [
              { time: "2026-01-01T10:00:00Z", lluvia: 2, lluvia_raw: 2.5 },
              { time: "2026-01-01T11:00:00Z", lluvia: 5, lluvia_raw: 6.5 },
            ]
          : [];

      const { data } = await fetchDatosPorEstacion(PARAMS_BASE);

      expect(data[1].lluvia).toBe(3);
      expect(data[1].lluvia_raw).toBe(4);
    });

    it("usa el acumulador directo en la primera hora del día local", async () => {
      // A las 03:00 UTC (00:00 argentina) el acumulador arrancó de cero: su
      // valor ya es la lluvia de esa hora, aunque la hora anterior traiga el
      // total acumulado de ayer.
      state.responder = (sql) =>
        sql.includes("meteo_minutales")
          ? [
              { time: "2026-01-01T02:00:00Z", lluvia: 10 },
              { time: "2026-01-01T03:00:00Z", lluvia: 1.2 },
            ]
          : [];

      const { data } = await fetchDatosPorEstacion(PARAMS_BASE);

      expect(data[1].lluvia).toBe(1.2);
    });

    it("interpreta un descenso del acumulador como reset", async () => {
      state.responder = (sql) =>
        sql.includes("meteo_minutales")
          ? [
              { time: "2026-01-01T10:00:00Z", lluvia: 8 },
              { time: "2026-01-01T11:00:00Z", lluvia: 0.5 },
            ]
          : [];

      const { data } = await fetchDatosPorEstacion(PARAMS_BASE);

      expect(data[1].lluvia).toBe(0.5);
    });

    // Tras un hueco, la diferencia acumula varias horas de lluvia: atribuirla
    // a una sola hora inventaría un pico que no existió.
    it("deja sin dato la hora que no tiene hora anterior contigua", async () => {
      state.responder = (sql) =>
        sql.includes("meteo_minutales")
          ? [
              { time: "2026-01-01T10:00:00Z", lluvia: 2 },
              { time: "2026-01-01T13:00:00Z", lluvia: 6 },
            ]
          : [];

      const { data } = await fetchDatosPorEstacion(PARAMS_BASE);

      expect(data[0].lluvia).toBeNull();
      expect(data[1].lluvia).toBeNull();
    });

    it("deriva la serie cruda y la validada de forma independiente", async () => {
      // Una hora sin minutos válidos corta la serie validada pero no la cruda.
      state.responder = (sql) =>
        sql.includes("meteo_minutales")
          ? [
              {
                time: "2026-01-01T10:00:00Z",
                lluvia: null as never,
                lluvia_raw: 2,
              },
              { time: "2026-01-01T11:00:00Z", lluvia: 5, lluvia_raw: 6 },
            ]
          : [];

      const { data } = await fetchDatosPorEstacion(PARAMS_BASE);

      expect(data[1].lluvia).toBeNull();
      expect(data[1].lluvia_raw).toBe(4);
    });

    it("no toca la lluvia minutal, que es el acumulador crudo del equipo", async () => {
      state.responder = (sql) =>
        sql.includes("meteo_minutales")
          ? [{ time: "2026-01-01T10:00:00Z", lluvia: 4 }]
          : [];

      const { data } = await fetchDatosPorEstacion({
        ...PARAMS_BASE,
        integration: "minute",
      });

      expect(data[0].lluvia).toBe(4);
    });
  });

  describe("unificación de tablas", () => {
    it("junta en una sola fila las métricas del mismo instante", async () => {
      state.responder = (sql) => {
        if (sql.includes("co_minutales"))
          return [{ time: "2026-01-01T10:00:00Z", co: 1 }];
        if (sql.includes("o3_minutales"))
          return [{ time: "2026-01-01T10:00:00Z", o3: 2 }];
        return [];
      };

      const { data } = await fetchDatosPorEstacion(PARAMS_BASE);

      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({ co: 1, o3: 2 });
    });

    it("ordena cronológicamente el resultado", async () => {
      state.responder = (sql) => {
        if (sql.includes("co_minutales"))
          return [{ time: "2026-01-01T12:00:00Z", co: 1 }];
        if (sql.includes("o3_minutales"))
          return [{ time: "2026-01-01T08:00:00Z", o3: 2 }];
        return [];
      };

      const { data } = await fetchDatosPorEstacion(PARAMS_BASE);

      expect(data.map((f) => f.time)).toEqual([
        "2026-01-01T08:00:00.000Z",
        "2026-01-01T12:00:00.000Z",
      ]);
    });

    it("normaliza los timestamps a ISO para poder unificarlos", async () => {
      state.responder = (sql) =>
        sql.includes("co_minutales")
          ? [{ time: new Date("2026-01-01T10:00:00Z").getTime(), co: 1 }]
          : [];

      const { data } = await fetchDatosPorEstacion(PARAMS_BASE);

      // Las tablas pueden devolver epoch o string; sin normalizar, el mismo
      // instante genera dos filas distintas en el archivo descargado.
      expect(data[0].time).toBe("2026-01-01T10:00:00.000Z");
    });
  });

  // Promise.allSettled y no Promise.all: son ocho tablas independientes y que
  // falte h2s no es razón para no entregar CO, O3 y meteorología.
  it("devuelve los datos de las tablas que sí respondieron cuando una falla", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    state.responder = (sql) => {
      if (sql.includes("h2s_minutales")) throw new Error("tabla caída");
      if (sql.includes("co_minutales"))
        return [{ time: "2026-01-01T10:00:00Z", co: 1 }];
      return [];
    };

    const { data } = await fetchDatosPorEstacion(PARAMS_BASE);

    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ co: 1 });
    consola.mockRestore();
  });

  it("propaga el rango pedido en meta", async () => {
    const { meta } = await fetchDatosPorEstacion(PARAMS_BASE);

    expect(meta).toEqual({
      location: "cifa",
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2026-01-02T00:00:00Z",
      integration: "hour",
    });
  });
});
