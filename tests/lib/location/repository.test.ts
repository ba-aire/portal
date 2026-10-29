// @vitest-environment node
//
// Este repositorio alimenta el SSE de /estaciones: siete queries en paralelo,
// una por tabla, de las que se toma el último minuto disponible. Lo que se
// verifica acá es lo que no se ve en la query: la heurística que decide si un
// timestamp viene en segundos o milisegundos, el redondeo que impone el schema
// y que la caída de una tabla no se lleve puesta a las otras seis.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Fila = Record<string, unknown>;

const { influx, state } = vi.hoisted(() => {
  const state = {
    queries: [] as string[],
    responder: (_sql: string): Fila[] => [],
  };

  const influx = {
    query: (sql: string, _database: string) => {
      state.queries.push(sql);
      // El responder se invoca DENTRO del generador, no al construirlo: así un
      // throw se convierte en promesa rechazada y lo absorbe Promise.allSettled,
      // que es exactamente lo que pasa cuando una tabla real falla.
      return (async function* () {
        for (const fila of state.responder(sql)) yield fila;
      })();
    },
  };

  return { influx, state };
});

vi.mock("@/db/influx", () => ({ influx }));

import { fetchLastMinuteByLocation } from "@/lib/location/repository";

function queries(): string[] {
  return state.queries.map((q) => q.replace(/\s+/g, " ").trim());
}

/** Responde sólo a la tabla indicada; el resto queda vacío. */
function soloTabla(tabla: string, filas: Fila[]) {
  return (sql: string) => (sql.includes(tabla) ? filas : []);
}

const TABLAS = [
  "co_minutales",
  "nox_minutales",
  "o3_minutales",
  "so2_minutales",
  "pm10_minutales",
  "pm25_minutales",
  "meteo_minutales",
];

describe("fetchLastMinuteByLocation", () => {
  beforeEach(() => {
    state.queries = [];
    state.responder = () => [];
  });

  describe("queries emitidas", () => {
    it("consulta las siete tablas de la estación", async () => {
      await fetchLastMinuteByLocation("cifa");

      expect(state.queries).toHaveLength(TABLAS.length);
      for (const tabla of TABLAS) {
        expect(queries().some((q) => q.includes(`FROM ${tabla}`))).toBe(true);
      }
    });

    it("filtra por la estación pedida", async () => {
      await fetchLastMinuteByLocation("cordoba");

      for (const q of queries()) {
        expect(q).toContain("WHERE location = 'cordoba'");
      }
    });

    // El panel muestra el último minuto: sin el LIMIT 1 sobre time DESC se
    // traería la tabla entera para descartar todo menos una fila.
    it("pide sólo el registro más reciente de cada tabla", async () => {
      await fetchLastMinuteByLocation("cifa");

      for (const q of queries()) {
        expect(q).toContain("ORDER BY time DESC LIMIT 1");
      }
    });
  });

  describe("interpretación de timestamps", () => {
    // InfluxDB puede devolver epoch en segundos o en milisegundos según la
    // tabla. Interpretar segundos como milisegundos ubica el dato en 1970 y el
    // panel lo marca como viejísimo; al revés lo manda al año 57.000.
    it("interpreta un epoch de 10 dígitos como segundos", async () => {
      const segundos = Math.floor(Date.UTC(2026, 0, 1) / 1000);
      state.responder = soloTabla("co_minutales", [
        { time: segundos, location: "cifa", co_mean: 1, status: "k" },
      ]);

      const data = await fetchLastMinuteByLocation("cifa");

      expect(data.latest_time).toEqual(new Date(segundos * 1000));
    });

    it("interpreta un epoch de 13 dígitos como milisegundos", async () => {
      const milis = Date.UTC(2026, 0, 1);
      state.responder = soloTabla("co_minutales", [
        { time: milis, location: "cifa", co_mean: 1, status: "k" },
      ]);

      const data = await fetchLastMinuteByLocation("cifa");

      expect(data.latest_time).toEqual(new Date(milis));
    });

    it("acepta un timestamp ISO en string", async () => {
      state.responder = soloTabla("co_minutales", [
        { time: "2026-01-01T00:00:00Z", location: "cifa", co_mean: 1 },
      ]);

      const data = await fetchLastMinuteByLocation("cifa");

      expect(data.latest_time).toEqual(new Date("2026-01-01T00:00:00Z"));
    });

    // latest_time es lo que la UI muestra como "última actualización": tiene que
    // ser el más nuevo de los siete, no el de la primera tabla que respondió.
    it("toma el más reciente entre todas las tablas", async () => {
      const viejo = "2026-01-01T10:00:00Z";
      const nuevo = "2026-01-01T10:05:00Z";
      state.responder = (sql) => {
        if (sql.includes("co_minutales"))
          return [{ time: viejo, location: "cifa", co_mean: 1 }];
        if (sql.includes("o3_minutales"))
          return [{ time: nuevo, location: "cifa", o3_mean: 2 }];
        return [];
      };

      const data = await fetchLastMinuteByLocation("cifa");

      expect(data.latest_time).toEqual(new Date(nuevo));
    });

    it("deja latest_time en null si ninguna tabla tiene datos", async () => {
      const data = await fetchLastMinuteByLocation("cifa");

      expect(data.latest_time).toBeNull();
    });
  });

  describe("armado de la respuesta", () => {
    it("devuelve null en los contaminantes sin dato", async () => {
      state.responder = soloTabla("co_minutales", [
        { time: "2026-01-01T10:00:00Z", location: "cifa", co_mean: 5 },
      ]);

      const data = await fetchLastMinuteByLocation("cifa");

      expect(data.co_mean).toBe(5);
      // Sin dato es null explícito, no undefined: la UI distingue "sin dato"
      // de "cero" y un undefined desaparecería al serializar a JSON.
      expect(data.o3_mean).toBeNull();
      expect(data.so2_mean).toBeNull();
      expect(data.nox_mean).toBeNull();
    });

    it("expande las tres especies del analizador de NOx", async () => {
      state.responder = soloTabla("nox_minutales", [
        {
          time: "2026-01-01T10:00:00Z",
          location: "cifa",
          no_mean: 1,
          no2_mean: 2,
          nox_mean: 3,
          status: "k",
        },
      ]);

      const data = await fetchLastMinuteByLocation("cifa");

      expect(data).toMatchObject({
        no_mean: 1,
        no2_mean: 2,
        nox_mean: 3,
        nox_mean_status: "k",
      });
    });

    // Cada magnitud se redondea a los decimales que tienen sentido para su
    // instrumento; el schema es el que lo impone, no la UI.
    it.each([
      ["co_mean", 1.2345, 1.23],
      ["pm10_mean", 42.678, 43],
      ["pm25_mean", 12.345, 12.3],
      ["no2_mean", 9.876, 9.9],
    ])("redondea %s", async (campo, crudo, esperado) => {
      const tabla = campo.startsWith("no")
        ? "nox_minutales"
        : `${campo.replace("_mean", "")}_minutales`;
      state.responder = soloTabla(tabla, [
        { time: "2026-01-01T10:00:00Z", location: "cifa", [campo]: crudo },
      ]);

      const data = await fetchLastMinuteByLocation("cifa");

      expect(data[campo as keyof typeof data]).toBe(esperado);
    });
  });

  // Promise.allSettled: son siete instrumentos independientes y que se caiga el
  // de SO2 no es motivo para dejar la estación entera sin mostrar.
  it("entrega el resto de los instrumentos cuando una tabla falla", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    state.responder = (sql) => {
      if (sql.includes("so2_minutales")) throw new Error("tabla caída");
      if (sql.includes("co_minutales"))
        return [{ time: "2026-01-01T10:00:00Z", location: "cifa", co_mean: 7 }];
      return [];
    };

    const data = await fetchLastMinuteByLocation("cifa");

    expect(data.co_mean).toBe(7);
    expect(data.so2_mean).toBeNull();
    consola.mockRestore();
  });
});
