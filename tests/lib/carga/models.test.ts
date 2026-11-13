// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  AnularSchema,
  CargaIdSchema,
  CargarSchema,
  ListarSchema,
  MAX_HORAS,
  VistaPreviaSchema,
} from "@/lib/carga/models";

const HORA = {
  parameter_code: "no",
  ts_hour: "2026-09-11T08:00:00.000Z",
  value: 5.26,
};
const BASE = {
  station_code: "cordoba",
  archivo: "nox.csv",
  motivo: "Corte de telemetría, bajado del analizador",
  horas: [HORA],
};
const error = (r: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) => (r.success ? null : r.error?.issues[0].message);

describe("CargarSchema", () => {
  it("acepta una carga completa, y sin archivo", () => {
    expect(CargarSchema.safeParse(BASE).success).toBe(true);
    expect(
      CargarSchema.safeParse({ ...BASE, archivo: undefined }).success,
    ).toBe(true);
  });

  it.each([
    [{ horas: [] }, "La carga no trae horas"],
    [{ motivo: "corto" }, "El motivo necesita al menos 10 caracteres"],
    [
      { motivo: "x".repeat(1001) },
      "El motivo no puede pasar de 1000 caracteres",
    ],
    [{ station_code: "Córdoba" }, "Código inválido"],
    [
      { horas: [{ ...HORA, ts_hour: "2026-09-11T08:30:00Z" }] },
      "Las horas tienen que estar en punto",
    ],
    [{ horas: [{ ...HORA, ts_hour: "ayer" }] }, "Hora inválida"],
    [{ horas: [{ ...HORA, parameter_code: "NO; DROP" }] }, "Código inválido"],
  ])("rechaza %j", (cambio, mensaje) => {
    expect(error(CargarSchema.safeParse({ ...BASE, ...cambio }))).toBe(mensaje);
  });

  it("rechaza un valor que no es un número finito", () => {
    for (const value of ["5", null, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        CargarSchema.safeParse({ ...BASE, horas: [{ ...HORA, value }] })
          .success,
      ).toBe(false);
    }
  });

  // El histórico no entra por el portal.
  it("rechaza una carga de más horas que el tope", () => {
    const horas = Array.from({ length: MAX_HORAS + 1 }, () => HORA);
    expect(error(CargarSchema.safeParse({ ...BASE, horas }))).toBe(
      `Una carga no puede pasar de ${MAX_HORAS} horas`,
    );
  });
});

describe("los demás esquemas", () => {
  it("la vista previa no pide motivo", () => {
    expect(
      VistaPreviaSchema.safeParse({ station_code: "cordoba", horas: [HORA] })
        .success,
    ).toBe(true);
  });
  it("anular recorta el motivo", () => {
    expect(
      AnularSchema.parse({ motivo: "  estación equivocada " }).motivo,
    ).toBe("estación equivocada");
  });
  it.each(["0", "-1", "1.5", "abc"])("rechaza el id %j", (id) => {
    expect(CargaIdSchema.safeParse(id).success).toBe(false);
  });
  it("el listado es de vigentes por defecto", () => {
    expect(ListarSchema.parse({})).toEqual({ estado: "vigentes" });
    expect(ListarSchema.safeParse({ estado: "borradas" }).success).toBe(false);
  });
});
