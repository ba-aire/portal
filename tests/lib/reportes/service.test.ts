// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/reportes/repository", () => ({
  fetchFicha: vi.fn(async () => [{ parameter_code: "no" }]),
  fetchDias: vi.fn(async () => [{ dia: 1 }]),
  fetchEstadisticos: vi.fn(async () => [{ serie: "1h" }]),
  fetchExcedencias: vi.fn(async () => []),
  fetchPerfil: vi.fn(async () => [{ hora_inicio: 23 }]),
}));

import * as repo from "@/lib/reportes/repository";
import { getReporteMensual } from "@/lib/reportes/service";

describe("getReporteMensual", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pide los parámetros del contaminante y el primer día del mes", async () => {
    const r = await getReporteMensual("catalinas", "nox", "2026-09");
    const args = ["catalinas", ["no", "no2", "nox"], "2026-09-01"];
    for (const f of [
      repo.fetchFicha,
      repo.fetchDias,
      repo.fetchEstadisticos,
      repo.fetchExcedencias,
      repo.fetchPerfil,
    ]) {
      expect(f).toHaveBeenCalledWith(...args);
    }
    expect(r).toMatchObject({
      estacion: "catalinas",
      contaminante: "nox",
      mes: "2026-09",
      ficha: [{ parameter_code: "no" }],
      dias: [{ dia: 1 }],
      perfil: [{ hora_inicio: 23 }],
    });
    expect(Number.isNaN(Date.parse(r.generado))).toBe(false);
  });
});
