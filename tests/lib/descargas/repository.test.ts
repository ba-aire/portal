// @vitest-environment node
//
// /descargas desde silver y gold. Lo que se verifica es lo que la versión de
// InfluxDB hacía a mano y ahora NO tiene que hacer (el BAM, la mediana, la
// lluvia: los resuelve ba-aire/data en V13 y V14), que los filtros viajen como
// parámetros, que cada integración lea lo que corresponde, y la conversión de
// lo que devuelve pg (numeric como string, timestamptz como Date).
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryAiredb, state } = vi.hoisted(() => {
  const state = { filas: [] as Record<string, unknown>[] };
  const queryAiredb = vi.fn(
    async (_sql: string, _params: unknown[]) => state.filas,
  );
  return { queryAiredb, state };
});

vi.mock("@/db/airedb", () => ({ queryAiredb }));

import { TABLE_CONFIG } from "@/lib/descargas/config";
import { __sql, fetchDatosPorEstacion } from "@/lib/descargas/repository";

const BASE = {
  location: "cordoba",
  startDate: "2026-10-06T03:00:00.000Z",
  endDate: "2026-10-07T03:00:00.000Z",
};

const plano = (s: string) => s.replace(/\s+/g, " ");

function ultimaLlamada(): { sql: string; params: unknown[] } {
  const llamada = queryAiredb.mock.calls.at(-1);
  if (!llamada) throw new Error("no se consultó airedb");
  return { sql: plano(String(llamada[0])), params: llamada[1] };
}

describe("fetchDatosPorEstacion", () => {
  beforeEach(() => {
    queryAiredb.mockClear();
    state.filas = [];
  });

  it("pasa estación, rango y parámetros como $1..$4, nunca interpolados", async () => {
    await fetchDatosPorEstacion({ ...BASE, integration: "hour" });
    const { sql, params } = ultimaLlamada();

    expect(params).toEqual([
      "cordoba",
      BASE.startDate,
      BASE.endDate,
      __sql.PARAMETROS,
    ]);
    expect(sql).not.toContain("cordoba");
    expect(sql).not.toContain("2026-10-06");
  });

  it("pide todos los parámetros de la config salvo h2s, que no existe en airedb", async () => {
    const esperados = Object.entries(TABLE_CONFIG)
      .filter(([g]) => g !== "h2s")
      .flatMap(([, c]) => c.metrics);
    expect(__sql.PARAMETROS).toEqual(esperados);
  });

  describe("por hora", () => {
    it("lee el crudo de silver (value_raw) y el validado de gold", async () => {
      await fetchDatosPorEstacion({ ...BASE, integration: "hour" });
      const { sql } = ultimaLlamada();

      expect(sql).toContain("FROM silver.hourly_reading");
      expect(sql).toContain("LEFT JOIN gold.v_hourly");
      expect(sql).toContain(`AS "co_raw"`);
      expect(sql).toMatch(
        /max\(validado\) FILTER \(WHERE parameter_code = 'co'\) AS "co"/,
      );
    });

    it("cuenta los minutos K por grupo y lista los status observados", async () => {
      await fetchDatosPorEstacion({ ...BASE, integration: "hour" });
      const { sql } = ultimaLlamada();

      expect(sql).toContain(`AS "nox_k_status"`);
      expect(sql).toContain(`AS "meteo_status"`);
      expect(sql).toContain("string_agg(DISTINCT letra");
    });

    it("lleva los status del BAM a la hora anterior, como la horaria de silver", async () => {
      await fetchDatosPorEstacion({ ...BASE, integration: "hour" });
      const { sql } = ultimaLlamada();

      expect(sql).toContain("publica_hora_anterior THEN INTERVAL '1 hour'");
      // Los minutos se leen una hora de más: la última hora de un BAM está ahí.
      expect(sql).toContain("$3::timestamptz + INTERVAL '1 hour'");
    });

    it("no calcula nada que ya resuelva airedb: ni mediana, ni lluvia, ni corrimientos de valores", async () => {
      await fetchDatosPorEstacion({ ...BASE, integration: "hour" });
      const { sql } = ultimaLlamada();

      expect(sql).not.toMatch(/percentile|median/i);
      expect(sql).not.toMatch(/lag\(/i);
    });

    it("convierte numeric a número, la fecha a ISO y deja status y rumbo como texto", async () => {
      state.filas = [
        {
          time: new Date("2026-10-06T15:00:00Z"),
          ts_hour: new Date("2026-10-06T15:00:00Z"),
          co: "0.412000",
          co_raw: "0.398",
          lluvia_raw: "2.3",
          dv_rumbo: "ENE",
          co_k_status: 45,
          co_status: "A,K",
          pm10: null,
        },
      ];
      const { data } = await fetchDatosPorEstacion({
        ...BASE,
        integration: "hour",
      });

      expect(data).toEqual([
        {
          time: "2026-10-06T15:00:00.000Z",
          co: 0.412,
          co_raw: 0.398,
          lluvia_raw: 2.3,
          dv_rumbo: "ENE",
          co_k_status: 45,
          co_status: "A,K",
          pm10: null,
        },
      ]);
    });
  });

  describe("por minuto", () => {
    it("lee silver.minute_reading, con el status del minuto y sin gold", async () => {
      await fetchDatosPorEstacion({ ...BASE, integration: "minute" });
      const { sql } = ultimaLlamada();

      expect(sql).toContain("FROM silver.minute_reading");
      expect(sql).not.toContain("gold.");
      expect(sql).toContain(`AS "nox_status"`);
      expect(sql).toContain(`AS "dv_rumbo"`);
    });
  });

  it("rechaza una integración desconocida sin consultar", async () => {
    await expect(
      fetchDatosPorEstacion({ ...BASE, integration: "week" }),
    ).rejects.toThrow("Invalid integration");
    expect(queryAiredb).not.toHaveBeenCalled();
  });

  it("propaga el rango pedido en meta", async () => {
    const { meta } = await fetchDatosPorEstacion({
      ...BASE,
      integration: "minute",
    });
    expect(meta).toEqual({ ...BASE, integration: "minute" });
  });
});
