// @vitest-environment node
//
// El repositorio de cargas: las horas viajan como UN parámetro jsonb (nunca
// interpoladas), el origen es siempre `portal`, y la escritura va solo por las
// funciones de V19 dentro de una transacción de escritura.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryAiredb, transaccionDeEscritura, consulta, state } = vi.hoisted(
  () => {
    const state = { filas: [] as unknown[] };
    const queryAiredb = vi.fn(
      async (_sql: string, _params?: unknown[]) => state.filas,
    );
    const consulta = vi.fn(async (_sql: string, _params?: unknown[]) => [
      { carga_id: "7" },
    ]);
    const transaccionDeEscritura = vi.fn(
      async (fn: (c: typeof consulta) => Promise<unknown>) => fn(consulta),
    );
    return { queryAiredb, transaccionDeEscritura, consulta, state };
  },
);

vi.mock("@/db/airedb", () => ({ queryAiredb, transaccionDeEscritura }));

import {
  anularCarga,
  fetchVistaPrevia,
  listarCargas,
  registrarCarga,
} from "@/lib/carga/repository";

const sql = () => String(queryAiredb.mock.calls[0][0]).replace(/\s+/g, " ");
const D = new Date("2026-09-11T08:00:00Z");
const H = new Date("2026-09-12T08:00:00Z");
const HORAS = [{ parameter_code: "no", ts_hour: D.toISOString(), value: 5.26 }];

const FILA = {
  carga_id: 1,
  origen: "portal",
  station_code: "cordoba",
  station_name: "Córdoba",
  archivo: "nox.csv",
  motivo: "m",
  registrado_por: "a@x",
  registrado_en: H,
  n_horas: 72,
  desde: D,
  hasta: H,
  parametros: ["no", "no2", "nox"],
  anulacion_id: null,
  anulacion_motivo: null,
  anulacion_por: null,
  anulacion_en: null,
};

beforeEach(() => {
  queryAiredb.mockClear();
  queryAiredb.mockImplementation(async () => state.filas);
  consulta.mockClear();
  transaccionDeEscritura.mockClear();
  state.filas = [];
});

describe("listarCargas", () => {
  it("lee el resumen, con los filtros como parámetros", async () => {
    state.filas = [
      FILA,
      {
        ...FILA,
        carga_id: 2,
        anulacion_id: 3,
        anulacion_motivo: "error",
        anulacion_por: "b@x",
        anulacion_en: H,
      },
    ];
    const r = await listarCargas({
      estado: "vigentes",
      station_code: "cordoba",
    });
    expect(queryAiredb.mock.calls[0][1]).toEqual(["cordoba", true]);
    expect(sql()).toContain("FROM carga.v_resumen r");
    expect(sql()).toContain("LIMIT 500");
    expect(r[0]).toMatchObject({
      desde: D.toISOString(),
      hasta: H.toISOString(),
      anulacion: null,
    });
    expect(r[1].anulacion).toEqual({
      carga_id: 3,
      motivo: "error",
      registrado_por: "b@x",
      registrado_en: H.toISOString(),
    });
  });

  // Defensivo: una carga sin horas o una anulación sin campos no rompe el listado.
  it("tolera nulos", async () => {
    state.filas = [
      {
        ...FILA,
        n_horas: null,
        desde: null,
        hasta: null,
        parametros: null,
        anulacion_id: 2,
      },
    ];
    const [r] = await listarCargas({ estado: "todas" });
    expect(queryAiredb.mock.calls[0][1]).toEqual([null, false]);
    expect(r).toMatchObject({
      n_horas: 0,
      desde: null,
      hasta: null,
      parametros: [],
    });
    expect(r.anulacion).toEqual({
      carga_id: 2,
      motivo: "",
      registrado_por: "",
      registrado_en: "",
    });
  });
});

describe("fetchVistaPrevia", () => {
  const PARAMETRO = {
    parameter_code: "no",
    display_name: "NO",
    unit: "ppb",
    horas: 1,
    desde: D,
    hasta: H,
    minimo: 5.26,
    maximo: 5.26,
    reemplaza_validas: 0,
    ya_cargadas: 1,
  };
  const SOLAPE = {
    carga_id: 4,
    archivo: "nox-vieja.csv",
    motivo: "corte de septiembre",
    registrado_por: "b@x",
    registrado_en: H,
    horas: 1,
    desde: D,
    hasta: H,
    parametros: ["no"],
  };
  // Cada consulta recibe su respuesta: la de parámetros agrupa por
  // parameter_code, la de solapes por carga.
  const responder = () =>
    queryAiredb.mockImplementation(async (s: string) =>
      s.includes("JOIN carga.carga c") ? [SOLAPE] : [PARAMETRO],
    );
  const sqlDe = (i: number) =>
    String(queryAiredb.mock.calls[i][0]).replace(/\s+/g, " ");

  it("manda las horas como un solo parámetro jsonb, a las dos consultas", async () => {
    responder();
    const v = await fetchVistaPrevia({ station_code: "cordoba", horas: HORAS });
    expect(queryAiredb).toHaveBeenCalledTimes(2);
    for (const [s, params] of queryAiredb.mock.calls) {
      expect(params).toEqual(["cordoba", JSON.stringify(HORAS)]);
      expect(s).toContain("jsonb_to_recordset($2::jsonb)");
    }
    expect(sqlDe(0)).toContain("gold.v_hourly");
    expect(sqlDe(0)).toContain("carga.v_vigente");
    expect(v.parametros[0]).toMatchObject({
      desde: D.toISOString(),
      ya_cargadas: 1,
    });
  });

  // Las cargas pisadas salen de lo VIGENTE (no de carga.hora: una hora que
  // otra carga ya ganó no es de la vieja), por estación, parámetro y hora.
  it("lista las cargas vigentes que el lote pisa", async () => {
    responder();
    const v = await fetchVistaPrevia({ station_code: "cordoba", horas: HORAS });
    const s = sqlDe(1);
    expect(s).toContain("JOIN carga.v_vigente v");
    expect(s).toContain("v.station_id = est.station_id");
    expect(s).toContain("v.parameter_code = l.parameter_code");
    expect(s).toContain("v.ts_hour = l.ts_hour");
    expect(s).not.toContain("carga.hora");
    expect(v.solapes).toEqual([
      {
        ...SOLAPE,
        registrado_en: H.toISOString(),
        desde: D.toISOString(),
        hasta: H.toISOString(),
      },
    ]);
  });

  it("sin solapes devuelve una lista vacía", async () => {
    queryAiredb.mockImplementation(async (s: string) =>
      s.includes("JOIN carga.carga c") ? [] : [PARAMETRO],
    );
    const v = await fetchVistaPrevia({ station_code: "cordoba", horas: HORAS });
    expect(v.solapes).toEqual([]);
  });
});

describe("escritura", () => {
  it("registrar llama a carga.cargar con origen portal, en una transacción de escritura", async () => {
    const id = await registrarCarga(
      {
        station_code: "cordoba",
        archivo: "nox.csv",
        motivo: "un motivo largo",
        horas: HORAS,
      },
      "ana@x",
    );
    expect(id).toBe(7);
    expect(transaccionDeEscritura).toHaveBeenCalledTimes(1);
    expect(queryAiredb).not.toHaveBeenCalled();
    expect(consulta.mock.calls[0][0]).toContain(
      "carga.cargar('portal', $1, $2, $3, $4, $5::jsonb)",
    );
    expect(consulta.mock.calls[0][1]).toEqual([
      "cordoba",
      "nox.csv",
      "un motivo largo",
      "ana@x",
      JSON.stringify(HORAS),
    ]);
  });

  it("sin archivo manda null", async () => {
    await registrarCarga(
      { station_code: "cordoba", motivo: "un motivo largo", horas: HORAS },
      "ana@x",
    );
    expect(consulta.mock.calls[0][1]?.[1]).toBeNull();
  });

  it("anular llama a carga.anular", async () => {
    await expect(anularCarga(3, "me equivoqué", "ana@x")).resolves.toBe(7);
    expect(consulta.mock.calls[0][0]).toContain("carga.anular($1, $2, $3)");
    expect(consulta.mock.calls[0][1]).toEqual([3, "me equivoqué", "ana@x"]);
  });
});
