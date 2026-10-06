// @vitest-environment node
//
// Este repositorio alimenta el SSE de /estaciones, cada 5 s: una sola consulta a
// bronze que trae la última lectura cruda de cada instrumento. Lo que se verifica
// acá es lo que no se ve en el SQL: que la estación viaje como parámetro y nunca
// interpolada, que la consulta mire solo una ventana reciente, y cómo cada fila
// de bronze se reparte en los campos que consume la UI.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Fila = {
  measurement: string;
  time: Date;
  status: string | null;
  v: Record<string, number | null>;
};

const { queryAiredb, state } = vi.hoisted(() => {
  const state = { filas: [] as Fila[] };
  const queryAiredb = vi.fn(
    async (_sql: string, _params: unknown[]) => state.filas,
  );
  return { queryAiredb, state };
});

vi.mock("@/db/airedb", () => ({ queryAiredb }));

import { fetchLastMinuteByLocation } from "@/lib/location/repository";

const T = new Date("2026-10-06T15:00:00.000Z");

function fila(
  measurement: string,
  v: Record<string, number | null>,
  opciones: { time?: Date; status?: string | null } = {},
): Fila {
  return {
    measurement,
    time: opciones.time ?? T,
    status: opciones.status === undefined ? "k" : opciones.status,
    v,
  };
}

function sqlEmitido(): string {
  return String(queryAiredb.mock.calls[0][0]).replace(/\s+/g, " ");
}

describe("fetchLastMinuteByLocation", () => {
  beforeEach(() => {
    queryAiredb.mockClear();
    state.filas = [];
  });

  describe("consulta", () => {
    it("hace UNA sola consulta, sobre las siete tablas de bronze", async () => {
      await fetchLastMinuteByLocation("cifa");

      expect(queryAiredb).toHaveBeenCalledTimes(1);
      for (const tabla of ["co", "nox", "o3", "so2", "pm10", "pm25", "meteo"]) {
        expect(sqlEmitido()).toContain(`FROM bronze.${tabla} `);
      }
    });

    it("pasa la estación como parámetro, nunca dentro del SQL", async () => {
      await fetchLastMinuteByLocation("catalinas");

      expect(sqlEmitido()).not.toContain("catalinas");
      expect(sqlEmitido()).toContain("location = $1");
      expect(queryAiredb.mock.calls[0][1]?.[0]).toBe("catalinas");
    });

    it("pide solo la lectura más reciente de cada tabla", async () => {
      await fetchLastMinuteByLocation("cifa");

      expect(sqlEmitido().match(/ORDER BY "time" DESC LIMIT 1/g)).toHaveLength(
        7,
      );
    });

    it("acota la búsqueda a una ventana reciente, para no barrer chunks comprimidos", async () => {
      await fetchLastMinuteByLocation("cifa");

      expect(sqlEmitido()).toContain(`"time" > now() - $2::interval`);
      expect(queryAiredb.mock.calls[0][1]?.[1]).toMatch(/minutes?$/);
    });
  });

  describe("armado de la respuesta", () => {
    it("devuelve null en los instrumentos sin lectura reciente", async () => {
      state.filas = [fila("co", { co: 0.5 })];

      const data = await fetchLastMinuteByLocation("cifa");

      expect(data.co_mean).toBe(0.5);
      expect(data.o3_mean).toBeNull();
      expect(data.o3_mean_status).toBeNull();
      expect(data.timestamps.o3).toBeNull();
      expect(data.dv_mean).toBeNull();
    });

    it("reparte las tres especies del analizador de NOx", async () => {
      state.filas = [
        fila("nox", { no: 3.04, no2: 21.56, nox: 24.6 }, { status: "a" }),
      ];

      const data = await fetchLastMinuteByLocation("cordoba");

      expect(data.no_mean).toBe(3);
      expect(data.no2_mean).toBe(21.6);
      expect(data.nox_mean).toBe(24.6);
      expect(data.nox_mean_status).toBe("a");
    });

    it("reparte las columnas de la estación meteorológica", async () => {
      state.filas = [
        fila("meteo", {
          dv: 182.4,
          hr_in: 40.2,
          hr: 71.6,
          lluvia: 0.2,
          temp: 18.25,
          temp_in: 24.1,
          vv: 3.27,
          pa: 1013.4,
          rs: 512,
          uv: 3,
        }),
      ];

      const data = await fetchLastMinuteByLocation("catalinas");

      expect(data).toMatchObject({
        dv_mean: 182,
        hr_in_mean: 40,
        hr_mean: 72,
        lluvia_mean: 0.2,
        temp_mean: 18.3,
        temp_in_mean: 24.1,
        vv_mean: 3.3,
        pa_mean: 1013,
        rs_mean: 512,
        uv_mean: 3,
      });
    });

    it("conserva el status de la lectura, incluso si no es atmósfera", async () => {
      // Un span de calibración llega con su valor de span: la UI lo pinta como
      // tal, en vez de dejarlo pasar como un episodio.
      state.filas = [fila("co", { co: 40 }, { status: "s" })];

      const data = await fetchLastMinuteByLocation("centenario");

      expect(data.co_mean).toBe(40);
      expect(data.co_mean_status).toBe("s");
    });

    it("toma como latest_time la lectura más reciente entre todas las tablas", async () => {
      state.filas = [
        fila("co", { co: 1 }, { time: new Date("2026-10-06T14:59:50Z") }),
        fila("o3", { o3: 2 }, { time: new Date("2026-10-06T15:00:05Z") }),
      ];

      const data = await fetchLastMinuteByLocation("cifa");

      expect(new Date(data.latest_time as Date).toISOString()).toBe(
        "2026-10-06T15:00:05.000Z",
      );
    });

    it("deja latest_time en null si ninguna tabla tiene lecturas recientes", async () => {
      const data = await fetchLastMinuteByLocation("cifa");

      expect(data.latest_time).toBeNull();
    });
  });

  it("propaga el error de la base, para que el SSE emita su evento de error", async () => {
    queryAiredb.mockRejectedValueOnce(new Error("connection refused"));

    await expect(fetchLastMinuteByLocation("cifa")).rejects.toThrow(
      "connection refused",
    );
  });
});
