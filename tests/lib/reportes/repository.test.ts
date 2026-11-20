// @vitest-environment node
//
// El repositorio no calcula nada: llama a las funciones de `reporte` de airedb.
// Lo que se verifica es lo que rompe sin avisar: que las tres entradas viajen
// como parámetros (nunca interpoladas), con el tipo que la función espera, y
// que los numeric vuelvan como float8 (node-postgres devuelve numeric como
// string, y "0.3" < 0.4 compara como texto).
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryAiredb } = vi.hoisted(() => ({
  queryAiredb: vi.fn(async (_sql: string, _params?: unknown[]) => []),
}));
vi.mock("@/db/airedb", () => ({ queryAiredb }));

import {
  fetchDias,
  fetchEstadisticos,
  fetchExcedencias,
  fetchFicha,
  fetchPerfil,
} from "@/lib/reportes/repository";

const ARGS: [string, string[], string] = [
  "centenario",
  ["no", "no2", "nox"],
  "2026-09-01",
];

describe("repositorio del reporte mensual", () => {
  beforeEach(() => queryAiredb.mockClear());

  it.each([
    [fetchFicha, "reporte.mensual_ficha", ["limite_deteccion::float8"]],
    [
      fetchDias,
      "reporte.mensual_dias",
      ["prom_24h::float8", "max_1h::float8", "min_1h::float8"],
    ],
    [
      fetchEstadisticos,
      "reporte.mensual_estadisticos",
      ["p95::float8", "desvio::float8"],
    ],
    [
      fetchExcedencias,
      "reporte.mensual_excedencias",
      ["limite::float8", "maximo::float8"],
    ],
    [fetchPerfil, "reporte.mensual_perfil_horario", ["valor::float8"]],
  ] as const)(
    "%o llama a %s con las entradas como parámetros",
    async (fn, funcion, casts) => {
      await fn(...ARGS);
      const [sql, params] = queryAiredb.mock.calls[0];
      const plano = sql.replace(/\s+/g, " ");
      expect(plano).toContain(`${funcion}($1, $2::text[], $3::date)`);
      for (const c of casts) expect(plano).toContain(c);
      expect(params).toEqual(ARGS);
      expect(plano).not.toContain("centenario");
    },
  );
});
