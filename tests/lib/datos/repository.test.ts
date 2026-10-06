// @vitest-environment node
//
// /datos desde silver y gold. Lo que se verifica es lo que no se ve en el SQL:
// que los filtros viajen como parametros, que cada intervalo consulte la tabla o
// vista correcta, como se pivotean las filas largas a las columnas que dibuja la
// UI, y que ya NO haya corrimientos de tiempo (los resuelven silver y V13).
import { beforeEach, describe, expect, it, vi } from "vitest";

type Fila = {
  t: Date;
  station_code: string;
  parameter_code: string;
  value: string | number | null;
  status?: string;
};

const { queryAiredb, state } = vi.hoisted(() => {
  const state = {
    // Respuestas por consulta: se elige por un fragmento del SQL.
    responder: (_sql: string): unknown[] => [],
  };
  const queryAiredb = vi.fn(async (sql: string, _params: unknown[]) =>
    state.responder(sql),
  );
  return { queryAiredb, state };
});

vi.mock("@/db/airedb", () => ({ queryAiredb }));

import { fetchDatosPorContaminante } from "@/lib/datos/repository";

const BASE = {
  locations: ["centenario", "cordoba"] as ("centenario" | "cordoba")[],
  startDate: "2026-10-01T03:00:00.000Z",
  endDate: "2026-10-02T03:00:00.000Z",
};

function fila(
  t: string,
  station_code: string,
  parameter_code: string,
  value: string | number | null,
  status?: string,
): Fila {
  return { t: new Date(t), station_code, parameter_code, value, status };
}

/** Responde segun la tabla o vista que aparezca en el SQL. */
function responderPor(por: Record<string, unknown[]>) {
  return (sql: string) => {
    for (const [fragmento, filas] of Object.entries(por)) {
      if (sql.includes(fragmento)) return filas;
    }
    return [];
  };
}

function sqls(): string[] {
  return queryAiredb.mock.calls.map((c) => String(c[0]).replace(/\s+/g, " "));
}

describe("fetchDatosPorContaminante", () => {
  beforeEach(() => {
    queryAiredb.mockClear();
    state.responder = () => [];
  });

  describe("consultas", () => {
    it("por minuto lee silver.minute_reading", async () => {
      await fetchDatosPorContaminante({
        ...BASE,
        contaminant: "co",
        interval: "minute",
      });

      expect(sqls().some((q) => q.includes("FROM silver.minute_reading"))).toBe(
        true,
      );
      expect(sqls().some((q) => q.includes("gold."))).toBe(false);
    });

    it("por hora lee silver.hourly_reading y gold.v_hourly, solo las horas validas de gold", async () => {
      await fetchDatosPorContaminante({
        ...BASE,
        contaminant: "co",
        interval: "hour",
      });

      expect(
        sqls().some((q) => q.includes("FROM silver.hourly_reading h JOIN")),
      ).toBe(true);
      const gold = sqls().find((q) => q.includes("FROM gold.v_hourly"));
      expect(gold).toContain("AND g.is_valid");
    });

    it("por dia lee gold.v_daily y agrega silver por dia de Buenos Aires", async () => {
      await fetchDatosPorContaminante({
        ...BASE,
        contaminant: "co",
        interval: "day",
      });

      expect(sqls().some((q) => q.includes("FROM gold.v_daily"))).toBe(true);
      expect(
        sqls().some(
          (q) =>
            q.includes("America/Argentina/Buenos_Aires") &&
            q.includes("avg(h.value)"),
        ),
      ).toBe(true);
    });

    it("pasa estaciones, parametros y rango como parametros, nunca dentro del SQL", async () => {
      await fetchDatosPorContaminante({
        ...BASE,
        contaminant: "nox",
        interval: "hour",
      });

      for (const q of sqls()) {
        expect(q).not.toContain("centenario");
        expect(q).not.toContain(BASE.startDate);
      }
      const args = queryAiredb.mock.calls.find((c) =>
        String(c[0]).includes("silver.hourly_reading h"),
      )?.[1];
      expect(args).toEqual([
        BASE.locations,
        ["no", "no2", "nox"],
        BASE.startDate,
        BASE.endDate,
      ]);
    });
  });

  describe("pivot", () => {
    it("arma una fila por instante con una columna por estacion", async () => {
      state.responder = responderPor({
        "silver.hourly_reading h": [
          fila("2026-10-01T10:00:00Z", "centenario", "co", "0.512"),
          fila("2026-10-01T10:00:00Z", "cordoba", "co", "0.3"),
          fila("2026-10-01T11:00:00Z", "centenario", "co", "0.6"),
        ],
      });

      const { data } = await fetchDatosPorContaminante({
        ...BASE,
        contaminant: "co",
        interval: "hour",
      });

      expect(data).toEqual([
        { time: "2026-10-01T10:00:00.000Z", centenario: 0.512, cordoba: 0.3 },
        { time: "2026-10-01T11:00:00.000Z", centenario: 0.6 },
      ]);
    });

    it("agrega la serie de gold con el sufijo (gold)", async () => {
      state.responder = responderPor({
        "silver.hourly_reading h": [
          fila("2026-10-01T10:00:00Z", "centenario", "co", "0.5"),
        ],
        "gold.v_hourly": [
          fila("2026-10-01T10:00:00Z", "centenario", "co", "0.49"),
        ],
      });

      const { data } = await fetchDatosPorContaminante({
        ...BASE,
        contaminant: "co",
        interval: "hour",
      });

      expect(data[0]).toEqual({
        time: "2026-10-01T10:00:00.000Z",
        centenario: 0.5,
        "centenario (gold)": 0.49,
      });
    });

    it("por minuto agrega el status de cada serie", async () => {
      state.responder = responderPor({
        "silver.minute_reading": [
          fila("2026-10-01T10:00:00Z", "centenario", "co", "0.5", "ok"),
          fila("2026-10-01T10:01:00Z", "centenario", "co", "40", "span"),
        ],
      });

      const { data } = await fetchDatosPorContaminante({
        ...BASE,
        contaminant: "co",
        interval: "minute",
      });

      expect(data[1]).toEqual({
        time: "2026-10-01T10:01:00.000Z",
        centenario: 40,
        "centenario@status": "span",
      });
    });

    it("nombra las series de NOx y de PM10+PM2.5 como la UI espera", async () => {
      state.responder = responderPor({
        "silver.hourly_reading h": [
          fila("2026-10-01T10:00:00Z", "cordoba", "no2", "20"),
          fila("2026-10-01T10:00:00Z", "cordoba", "nox", "30"),
        ],
      });

      const { data } = await fetchDatosPorContaminante({
        ...BASE,
        contaminant: "nox",
        interval: "hour",
      });

      expect(data[0]).toMatchObject({ "cordoba NO2": 20, "cordoba NOx": 30 });
    });

    it("no corre el PM10 en el tiempo: lo resuelve la horaria de silver (V13)", async () => {
      state.responder = responderPor({
        "silver.hourly_reading h": [
          fila("2026-10-01T10:00:00Z", "centenario", "pm10", "42"),
        ],
      });

      const { data } = await fetchDatosPorContaminante({
        ...BASE,
        contaminant: "pm10",
        interval: "hour",
      });

      expect(data[0]).toEqual({
        time: "2026-10-01T10:00:00.000Z",
        centenario: 42,
      });
    });

    it("convierte el numeric de pg (string) a number, y conserva los null", async () => {
      state.responder = responderPor({
        "silver.minute_reading": [
          fila("2026-10-01T10:00:00Z", "cifa", "o3", null, "no_link"),
        ],
      });

      const { data } = await fetchDatosPorContaminante({
        ...BASE,
        locations: ["cifa"],
        contaminant: "o3",
        interval: "minute",
      });

      expect(data[0].cifa).toBeNull();
    });
  });

  it("informa hasta donde proceso la horaria", async () => {
    state.responder = responderPor({
      "max(ts_hour)": [{ hasta: new Date("2026-10-06T17:00:00Z") }],
    });

    const { meta } = await fetchDatosPorContaminante({
      ...BASE,
      contaminant: "co",
      interval: "hour",
    });

    expect(meta.procesadoHasta).toBe("2026-10-06T17:00:00.000Z");
  });
});
