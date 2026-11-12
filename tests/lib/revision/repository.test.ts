// @vitest-environment node
//
// El repositorio de revisiones: lo que importa y no se ve en el resultado es
// que todo valor viaje como parámetro, y que la escritura vaya SOLO por las
// funciones de V18 dentro de una transacción de escritura.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryAiredb, transaccionDeEscritura, consulta, state } = vi.hoisted(
  () => {
    const state = { filas: [] as unknown[][] };
    const queryAiredb = vi.fn(
      async (_sql: string, _params?: unknown[]) => state.filas.shift() ?? [],
    );
    const consulta = vi.fn(async (_sql: string, _params?: unknown[]) => [
      { revision_id: "7" },
    ]);
    const transaccionDeEscritura = vi.fn(
      async (fn: (c: typeof consulta) => Promise<unknown>) => fn(consulta),
    );
    return { queryAiredb, transaccionDeEscritura, consulta, state };
  },
);

vi.mock("@/db/airedb", () => ({ queryAiredb, transaccionDeEscritura }));

import {
  anularRevision,
  fetchCatalogo,
  fetchVistaPrevia,
  listarRevisiones,
  registrarRevision,
} from "@/lib/revision/repository";

const sql = (i: number) =>
  String(queryAiredb.mock.calls[i][0]).replace(/\s+/g, " ");
const D = new Date("2026-11-10T13:00:00Z");
const H = new Date("2026-11-10T14:00:00Z");

beforeEach(() => {
  queryAiredb.mockClear();
  consulta.mockClear();
  transaccionDeEscritura.mockClear();
  state.filas = [];
});

describe("listarRevisiones", () => {
  it("pasa los filtros como parámetros y arma la anulación", async () => {
    state.filas = [
      [
        {
          revision_id: 2,
          accion: "invalidar",
          station_code: "cifa",
          station_name: "CIFA",
          parameter_code: null,
          measurement: "nox",
          desde: D,
          hasta: H,
          motivo: "m",
          registrado_por: "a@x",
          registrado_en: H,
          anulacion_id: 3,
          anulacion_motivo: "error",
          anulacion_por: "b@x",
          anulacion_en: H,
        },
        {
          revision_id: 1,
          accion: "reincorporar",
          station_code: "cifa",
          station_name: "CIFA",
          parameter_code: "co",
          measurement: null,
          desde: D,
          hasta: H,
          motivo: "m",
          registrado_por: "a@x",
          registrado_en: H,
          anulacion_id: null,
          anulacion_motivo: null,
          anulacion_por: null,
          anulacion_en: null,
        },
      ],
    ];
    const r = await listarRevisiones({
      estado: "vigentes",
      station_code: "cifa",
      desde: D,
    });
    expect(queryAiredb.mock.calls[0][1]).toEqual(["cifa", true, D, null]);
    expect(sql(0)).toContain("FROM revision.revision r");
    expect(sql(0)).toContain("WHERE r.accion <> 'anular'");
    expect(sql(0)).toContain("LIMIT 500");
    expect(r[0].anulacion).toEqual({
      revision_id: 3,
      motivo: "error",
      registrado_por: "b@x",
      registrado_en: H.toISOString(),
    });
    expect(r[1].anulacion).toBeNull();
    expect(r[1].desde).toBe(D.toISOString());
  });

  it("todas, sin filtros: todo en null", async () => {
    await listarRevisiones({ estado: "todas" });
    expect(queryAiredb.mock.calls[0][1]).toEqual([null, false, null, null]);
  });

  // Defensivo: una anulación sin campos no rompe el listado.
  it("anulación con campos nulos", async () => {
    state.filas = [
      [
        {
          revision_id: 1,
          accion: "invalidar",
          station_code: "c",
          station_name: "C",
          parameter_code: "co",
          measurement: null,
          desde: D,
          hasta: H,
          motivo: "m",
          registrado_por: "a",
          registrado_en: H,
          anulacion_id: 2,
          anulacion_motivo: null,
          anulacion_por: null,
          anulacion_en: null,
        },
      ],
    ];
    const [r] = await listarRevisiones({ estado: "todas" });
    expect(r.anulacion).toEqual({
      revision_id: 2,
      motivo: "",
      registrado_por: "",
      registrado_en: "",
    });
  });
});

describe("fetchCatalogo", () => {
  it("lee estaciones y parámetros de dim", async () => {
    state.filas = [[{ station_code: "cifa", station_name: "CIFA" }], []];
    const c = await fetchCatalogo();
    expect(c.estaciones).toHaveLength(1);
    expect(sql(0)).toContain("FROM dim.stations");
    expect(sql(1)).toContain("FROM dim.parameters");
  });
});

describe("fetchVistaPrevia", () => {
  it("cose minutos, horas y superpuestas por parámetro", async () => {
    state.filas = [
      [
        { parameter_code: "no", display_name: "NO" },
        { parameter_code: "no2", display_name: "NO₂" },
      ],
      [
        { parameter_code: "no", status: "ok", minutos: 50 },
        { parameter_code: "no", status: "invalidado", minutos: 10 },
      ],
      [{ parameter_code: "no", horas: 2, horas_validas: 1 }],
      [
        {
          revision_id: 9,
          accion: "invalidar",
          parameter_code: null,
          measurement: "nox",
          desde: D,
          hasta: H,
        },
      ],
    ];
    const v = await fetchVistaPrevia({
      station_code: "catalinas",
      parameter_code: null,
      measurement: "nox",
      desde: D,
      hasta: H,
    });
    expect(queryAiredb.mock.calls[0][1]).toEqual([null, "nox"]);
    for (const i of [1, 2, 3]) {
      expect(queryAiredb.mock.calls[i][1]).toEqual([
        "catalinas",
        null,
        "nox",
        D,
        H,
      ]);
    }
    // El corrimiento del BAM: se busca por el instante publicado.
    expect(sql(1)).toContain("publica_hora_anterior");
    expect(sql(1)).toContain("revision.v_vigente");
    expect(sql(2)).toContain("FROM gold.v_hourly");
    expect(sql(3)).toContain("FROM revision.v_vigente");
    expect(v.parametros).toEqual([
      {
        parameter_code: "no",
        display_name: "NO",
        minutos: { ok: 50, invalidado: 10 },
        horas: 2,
        horas_validas: 1,
      },
      {
        parameter_code: "no2",
        display_name: "NO₂",
        minutos: {},
        horas: 0,
        horas_validas: 0,
      },
    ]);
    expect(v.superpuestas[0].desde).toBe(D.toISOString());
  });
});

describe("escritura", () => {
  it("registrar llama a revision.registrar en una transacción de escritura", async () => {
    const id = await registrarRevision(
      {
        accion: "invalidar",
        station_code: "cifa",
        parameter_code: "co",
        desde: D,
        hasta: H,
        motivo: "un motivo largo",
      },
      "ana@x",
    );
    expect(id).toBe(7);
    expect(transaccionDeEscritura).toHaveBeenCalledTimes(1);
    expect(queryAiredb).not.toHaveBeenCalled();
    expect(consulta.mock.calls[0][0]).toContain(
      "revision.registrar($1, $2, $3, $4, $5, $6, $7, $8)",
    );
    expect(consulta.mock.calls[0][1]).toEqual([
      "invalidar",
      "cifa",
      "co",
      null,
      D,
      H,
      "un motivo largo",
      "ana@x",
    ]);
  });

  it("registrar un equipo manda el parámetro en null", async () => {
    await registrarRevision(
      {
        accion: "reincorporar",
        station_code: "cifa",
        measurement: "nox",
        desde: D,
        hasta: H,
        motivo: "un motivo largo",
      },
      "ana@x",
    );
    expect(consulta.mock.calls[0][1]?.slice(2, 4)).toEqual([null, "nox"]);
  });

  it("anular llama a revision.anular", async () => {
    await expect(anularRevision(3, "me equivoqué", "ana@x")).resolves.toBe(7);
    expect(consulta.mock.calls[0][0]).toContain("revision.anular($1, $2, $3)");
    expect(consulta.mock.calls[0][1]).toEqual([3, "me equivoqué", "ana@x"]);
  });
});
