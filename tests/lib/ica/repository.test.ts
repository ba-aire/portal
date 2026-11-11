// @vitest-environment node
//
// El repositorio del índice no calcula nada: lee las vistas gold.v_ica_* de
// airedb. Lo que se verifica es lo que no se ve en el resultado y rompe sin
// avisar: que el índice elegido filtre TODA consulta (las vistas traen los dos
// mezclados), que viaje como parámetro, y que la consulta acote por ts_hour
// (sin eso la vista recorre toda la historia).
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryAiredb, state } = vi.hoisted(() => {
  const state = { filas: [] as unknown[] };
  const queryAiredb = vi.fn(
    async (_sql: string, _params?: unknown[]) => state.filas,
  );
  return { queryAiredb, state };
});

vi.mock("@/db/airedb", () => ({ queryAiredb }));

import {
  fetchIcaCategorias,
  fetchIcaEstaciones,
  fetchNombresDeParametros,
  VENTANA,
} from "@/lib/ica/repository";

function sqlEmitido(): string {
  return String(queryAiredb.mock.calls[0][0]).replace(/\s+/g, " ");
}

describe("repositorio del índice", () => {
  beforeEach(() => {
    queryAiredb.mockClear();
    state.filas = [];
  });

  describe("fetchIcaEstaciones", () => {
    it("lee la vista horaria por estación", async () => {
      await fetchIcaEstaciones("EPA");

      expect(queryAiredb).toHaveBeenCalledTimes(1);
      expect(sqlEmitido()).toContain("FROM gold.v_ica_horario");
    });

    it("pasa el índice como parámetro, nunca dentro del SQL", async () => {
      await fetchIcaEstaciones("EEA");

      expect(sqlEmitido()).toContain("v.indice = $1");
      expect(sqlEmitido()).not.toContain("EEA");
      expect(queryAiredb.mock.calls[0][1]).toEqual(["EEA", VENTANA]);
    });

    // Sin el filtro por ts_hour, la vista calcula el índice de toda la historia
    // para quedarse con una fila por estación.
    it("acota la búsqueda a una ventana reciente de ts_hour", async () => {
      await fetchIcaEstaciones("EPA");

      expect(sqlEmitido()).toContain("v.ts_hour >= now() - $2::interval");
    });

    it("trae la última hora de cada estación, no todas", async () => {
      await fetchIcaEstaciones("EPA");

      expect(sqlEmitido()).toContain("ORDER BY v.ts_hour DESC LIMIT 1");
    });

    // Una estación sin índice tiene que seguir en el mapa, en gris. Con un JOIN
    // común desaparecería y parecería que la red tiene una estación menos.
    it("parte de dim.stations con LEFT JOIN: no pierde la estación sin índice", async () => {
      await fetchIcaEstaciones("EPA");

      expect(sqlEmitido()).toContain("FROM dim.stations s LEFT JOIN LATERAL");
    });

    it("devuelve las filas tal como vienen", async () => {
      state.filas = [{ station_code: "cifa", categoria: 2 }];

      await expect(fetchIcaEstaciones("EPA")).resolves.toEqual(state.filas);
    });
  });

  describe("fetchIcaCategorias", () => {
    it("filtra las categorías por el índice, en orden", async () => {
      await fetchIcaCategorias("EEA");

      expect(sqlEmitido()).toContain("FROM indice.v_categoria");
      expect(sqlEmitido()).toContain("WHERE indice = $1 ORDER BY categoria");
      expect(queryAiredb.mock.calls[0][1]).toEqual(["EEA"]);
    });
  });

  describe("fetchNombresDeParametros", () => {
    it("arma el mapa código -> nombre desde dim.parameters", async () => {
      state.filas = [
        { parameter_code: "no2", display_name: "NO₂" },
        { parameter_code: "pm25", display_name: "PM₂.₅" },
      ];

      await expect(fetchNombresDeParametros()).resolves.toEqual({
        no2: "NO₂",
        pm25: "PM₂.₅",
      });
      expect(sqlEmitido()).toContain("FROM dim.parameters");
    });
  });
});
