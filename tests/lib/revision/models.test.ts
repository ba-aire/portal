// @vitest-environment node
//
// La forma del pedido se corta acá, con un mensaje claro, antes de llegar a la
// base (que vuelve a validar todo con sus CHECK y revision.registrar).
import { describe, expect, it } from "vitest";
import {
  AnularSchema,
  ListarSchema,
  RegistrarSchema,
  RevisionIdSchema,
  VistaPreviaSchema,
} from "@/lib/revision/models";

const BASE = {
  accion: "invalidar",
  station_code: "centenario",
  parameter_code: "co",
  desde: "2026-11-10T13:00:00.000Z",
  hasta: "2026-11-10T14:30:00.000Z",
  motivo: "Equipo descalibrado, constatado en visita",
};

function error(r: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return r.success ? null : r.error?.issues[0].message;
}

describe("RegistrarSchema", () => {
  it("acepta un pedido completo y pasa las fechas a Date", () => {
    const r = RegistrarSchema.parse(BASE);
    expect(r.desde).toEqual(new Date("2026-11-10T13:00:00Z"));
    expect(r.motivo).toBe(BASE.motivo);
  });

  it("acepta un equipo en lugar de un parámetro", () => {
    const r = RegistrarSchema.safeParse({
      ...BASE,
      parameter_code: null,
      measurement: "nox",
    });
    expect(r.success).toBe(true);
  });

  it.each([
    [
      { parameter_code: null },
      "Hay que elegir un parámetro o un equipo, uno solo",
    ],
    [
      { measurement: "nox" },
      "Hay que elegir un parámetro o un equipo, uno solo",
    ],
    [{ hasta: BASE.desde }, "«Desde» tiene que ser anterior a «hasta»"],
    [
      { desde: "2026-11-10T13:00:30Z" },
      "La fecha tiene que caer en un minuto entero",
    ],
    [{ desde: "ayer" }, "Fecha inválida"],
    [
      { hasta: "2027-11-12T13:00:00Z" },
      "El período no puede pasar de 366 días",
    ],
    [{ motivo: "   corto   " }, "El motivo necesita al menos 10 caracteres"],
    [
      { motivo: "x".repeat(1001) },
      "El motivo no puede pasar de 1000 caracteres",
    ],
    [{ station_code: "Centenario; DROP" }, "Código inválido"],
  ])("rechaza %j", (cambio, mensaje) => {
    expect(error(RegistrarSchema.safeParse({ ...BASE, ...cambio }))).toBe(
      mensaje,
    );
  });

  // anular tiene su propia ruta: por acá no se puede.
  it("no acepta la acción anular", () => {
    expect(
      RegistrarSchema.safeParse({ ...BASE, accion: "anular" }).success,
    ).toBe(false);
  });
});

describe("VistaPreviaSchema", () => {
  it("no pide acción ni motivo", () => {
    const { accion: _a, motivo: _m, ...resto } = BASE;
    expect(VistaPreviaSchema.safeParse(resto).success).toBe(true);
  });
});

describe("AnularSchema y RevisionIdSchema", () => {
  it("recorta el motivo", () => {
    expect(
      AnularSchema.parse({ motivo: "  me equivoqué de equipo " }).motivo,
    ).toBe("me equivoqué de equipo");
  });

  it.each(["0", "-1", "1.5", "abc"])("rechaza el id %j", (id) => {
    expect(RevisionIdSchema.safeParse(id).success).toBe(false);
  });

  it("acepta un id entero positivo", () => {
    expect(RevisionIdSchema.parse("42")).toBe(42);
  });
});

describe("ListarSchema", () => {
  it("por defecto, solo vigentes", () => {
    expect(ListarSchema.parse({})).toEqual({ estado: "vigentes" });
  });

  it("convierte las fechas", () => {
    const r = ListarSchema.parse({
      estado: "todas",
      station_code: "cifa",
      desde: "2026-11-01T00:00:00Z",
      hasta: "2026-11-02T00:00:00Z",
    });
    expect(r.desde).toEqual(new Date("2026-11-01T00:00:00Z"));
    expect(r.hasta).toEqual(new Date("2026-11-02T00:00:00Z"));
  });

  it.each([{ estado: "anuladas" }, { desde: "nunca" }, { hasta: "nunca" }])(
    "rechaza %j",
    (q) => {
      expect(ListarSchema.safeParse(q).success).toBe(false);
    },
  );
});
