// @vitest-environment node
//
// El repositorio arma SQL crudo por interpolación de strings. No hay forma de
// verificarlo contra una InfluxDB real en CI, así que se intercepta el cliente
// y se afirma sobre la query generada: es la única capa donde un shift de
// tiempo mal puesto o una tabla equivocada se puede detectar sin datos vivos.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Fila = Record<string, string | number>;

const { influx, state } = vi.hoisted(() => {
  const state = {
    queries: [] as string[],
    /** Devuelve las filas con las que responde InfluxDB para una query dada. */
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

import { fetchDatosPorContaminante } from "@/lib/datos/repository";

/** Queries emitidas, con los espacios colapsados para poder matchear. */
function queries(): string[] {
  return state.queries.map((q) => q.replace(/\s+/g, " ").trim());
}

const PARAMS_BASE = {
  contaminant: "co",
  locations: ["centenario"],
  startDate: "2026-01-01T00:00:00Z",
  endDate: "2026-01-02T00:00:00Z",
  interval: "hour",
};

describe("fetchDatosPorContaminante", () => {
  beforeEach(() => {
    state.queries = [];
    state.responder = () => [];
  });

  describe("elección de tabla y columna", () => {
    it.each([
      ["co", "co_minutales", "co_mean"],
      ["no2", "nox_minutales", "no2_mean"],
      ["no", "nox_minutales", "no_mean"],
      ["pm10", "pm10_minutales", "pm10_mean"],
      ["pm25", "pm25_minutales", "pm25_mean"],
      ["o3", "o3_minutales", "o3_mean"],
      ["so2", "so2_minutales", "so2_mean"],
    ])("%s consulta %s tomando %s", async (contaminant, tabla, columna) => {
      await fetchDatosPorContaminante({ ...PARAMS_BASE, contaminant });

      expect(queries()[0]).toContain(`FROM ${tabla}`);
      expect(queries()[0]).toContain(`THEN ${columna} END`);
    });

    // NO, NO2 y NOx salen del mismo analizador y por lo tanto de la misma tabla:
    // si alguien agregara nox_minutales por separado, este test lo marca.
    it("agrupa no, no2 y nox en la tabla del analizador de NOx", async () => {
      for (const contaminant of ["no", "no2", "nox"]) {
        await fetchDatosPorContaminante({ ...PARAMS_BASE, contaminant });
      }

      for (const q of queries()) expect(q).toContain("FROM nox_minutales");
    });
  });

  describe("alineación temporal de los buckets", () => {
    // En las tablas minutales el timestamp marca el FIN del minuto: el registro
    // de 12:00 es el muestreo 11:59-12:00 y pertenece al promedio 11-12. Sin el
    // shift, cada valor se contabiliza en la hora siguiente a la que le toca.
    it("corre un minuto hacia atrás al agrupar por hora", async () => {
      await fetchDatosPorContaminante({ ...PARAMS_BASE, interval: "hour" });

      expect(queries()[0]).toContain(
        "DATE_TRUNC('hour', time - INTERVAL '1 minute')",
      );
    });

    // Con interval "minute" cada registro ya es su propio bucket: aplicar el
    // shift lo correría un minuto entero respecto de su propia marca.
    it("no aplica el shift cuando el intervalo es minutal", async () => {
      await fetchDatosPorContaminante({ ...PARAMS_BASE, interval: "minute" });

      expect(queries()[0]).toContain("DATE_TRUNC('minute', time)");
      expect(queries()[0]).not.toContain("INTERVAL '1 minute'");
    });

    // El BAM1020 mide durante una hora y publica el resultado en la hora
    // siguiente, así que pm10 lleva una hora extra de corrimiento sobre el
    // shift minutal común.
    it("resta una hora adicional para pm10", async () => {
      await fetchDatosPorContaminante({
        ...PARAMS_BASE,
        contaminant: "pm10",
      });

      expect(queries()[0]).toContain(
        "time - INTERVAL '1 minute' - INTERVAL '1 hour'",
      );
    });

    it("no aplica el corrimiento del BAM1020 a otros contaminantes", async () => {
      await fetchDatosPorContaminante({ ...PARAMS_BASE, contaminant: "o3" });

      expect(queries()[0]).not.toContain("INTERVAL '1 hour'");
    });
  });

  describe("columnas por estación", () => {
    it("genera una columna por estación con su alias", async () => {
      await fetchDatosPorContaminante({
        ...PARAMS_BASE,
        locations: ["centenario", "cifa"],
      });

      expect(queries()[0]).toContain('AS "centenario"');
      expect(queries()[0]).toContain('AS "cifa"');
    });

    // Un solo pedido de NOx devuelve las tres especies: el analizador las mide
    // juntas y la UI las grafica superpuestas.
    it("expande nox en tres columnas por estación", async () => {
      await fetchDatosPorContaminante({ ...PARAMS_BASE, contaminant: "nox" });

      expect(queries()[0]).toContain('AS "centenario NO2"');
      expect(queries()[0]).toContain('AS "centenario NO"');
      expect(queries()[0]).toContain('AS "centenario NOx"');
    });
  });

  describe("pm1025 (PM10 + PM2.5)", () => {
    it("consulta las dos tablas y mergea por timestamp", async () => {
      state.responder = (sql) =>
        sql.includes("pm10_minutales")
          ? [{ time: "2026-01-01T10:00:00Z", "centenario PM10": 30 }]
          : [{ time: "2026-01-01T10:00:00Z", "centenario PM25": 12 }];

      const { data } = await fetchDatosPorContaminante({
        ...PARAMS_BASE,
        contaminant: "pm1025",
      });

      expect(state.queries).toHaveLength(2);
      // Viven en tablas distintas pero son una sola fila para el usuario.
      expect(data).toEqual([
        {
          time: "2026-01-01T10:00:00Z",
          "centenario PM10": 30,
          "centenario PM25": 12,
        },
      ]);
    });

    it("aplica el corrimiento del BAM1020 sólo a la query de pm10", async () => {
      await fetchDatosPorContaminante({
        ...PARAMS_BASE,
        contaminant: "pm1025",
      });

      const pm10 = queries().find((q) => q.includes("FROM pm10_minutales"));
      const pm25 = queries().find((q) => q.includes("FROM pm25_minutales"));

      expect(pm10).toContain("INTERVAL '1 hour'");
      expect(pm25).not.toContain("INTERVAL '1 hour'");
    });

    it("ordena cronológicamente el resultado unificado", async () => {
      state.responder = (sql) =>
        sql.includes("pm10_minutales")
          ? [{ time: "2026-01-01T12:00:00Z", a: 1 }]
          : [{ time: "2026-01-01T09:00:00Z", b: 2 }];

      const { data } = await fetchDatosPorContaminante({
        ...PARAMS_BASE,
        contaminant: "pm1025",
      });

      expect(data.map((f) => f.time)).toEqual([
        "2026-01-01T09:00:00Z",
        "2026-01-01T12:00:00Z",
      ]);
    });
  });

  describe("recorte de la ventana pedida", () => {
    // Los shifts empujan buckets hacia atrás: el registro de las 00:00 del
    // startDate puede caer en las 23:xx del día anterior. Devolverlo sería
    // mostrar datos fuera del rango que el usuario pidió.
    it("descarta filas que quedaron antes del startDate tras el shift", async () => {
      state.responder = () => [
        { time: "2025-12-31T23:00:00Z", centenario: 1 },
        { time: "2026-01-01T00:00:00Z", centenario: 2 },
        { time: "2026-01-01T01:00:00Z", centenario: 3 },
      ];

      const { data } = await fetchDatosPorContaminante(PARAMS_BASE);

      expect(data.map((f) => f.centenario)).toEqual([2, 3]);
    });

    it("conserva la fila que cae justo en el startDate", async () => {
      state.responder = () => [{ time: "2026-01-01T00:00:00Z", centenario: 7 }];

      const { data } = await fetchDatosPorContaminante(PARAMS_BASE);

      expect(data).toHaveLength(1);
    });
  });

  it("propaga el rango pedido en meta", async () => {
    const { meta } = await fetchDatosPorContaminante(PARAMS_BASE);

    expect(meta).toEqual({
      contaminant: "co",
      locations: ["centenario"],
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2026-01-02T00:00:00Z",
      interval: "hour",
    });
  });

  // El service no envuelve el error a propósito, para que la route pueda
  // distinguir un fallo de InfluxDB (500 genérico) de una validación (400).
  // Si el repositorio se lo tragara y devolviera [], el dashboard mostraría
  // "sin datos" ante una caída de la base.
  it("propaga el error de InfluxDB en vez de devolver vacío", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    state.responder = () => {
      throw new Error("influx caída");
    };

    await expect(fetchDatosPorContaminante(PARAMS_BASE)).rejects.toThrow(
      "influx caída",
    );

    consola.mockRestore();
  });
});
