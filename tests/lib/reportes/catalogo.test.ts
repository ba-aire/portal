// @vitest-environment node
//
// El catálogo de /reportes: qué reportes hay, cómo se agrupan en el select y
// cómo se lee de la URL el reporte elegido con sus filtros.
import { describe, expect, it } from "vitest";
import {
  nombreDelReporte,
  pedidoDe,
  REPORTES,
  reporteDe,
  reportesPorTipo,
  TIPOS,
} from "@/lib/reportes/catalogo";
import { PLANTILLAS } from "@/lib/reportes/config";

describe("catálogo de reportes", () => {
  it("ids únicos, y cada uno con un tipo y una plantilla que existen", () => {
    const ids = REPORTES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of REPORTES) {
      expect(TIPOS[r.tipo]).toBeDefined();
      expect(PLANTILLAS[r.plantilla]).toBeDefined();
    }
  });

  it("el mensual, en sus dos plantillas", () => {
    expect(reporteDe("mensual-clasico")).toMatchObject({
      tipo: "mensual",
      plantilla: "clasico",
    });
    expect(reporteDe("mensual-nuevo")?.plantilla).toBe("nuevo");
    expect(reporteDe("anual")).toBeNull();
    expect(reporteDe(undefined)).toBeNull();
  });

  it("en el select se agrupan por tipo", () => {
    const grupos = reportesPorTipo();
    expect(grupos.map((g) => g.tipo)).toEqual(["mensual"]);
    expect(grupos[0].reportes.map((r) => r.id)).toEqual([
      "mensual-clasico",
      "mensual-nuevo",
      "mensual-acumar",
    ]);
  });

  it("la de ACUMAR es la clásica con otro emisor", () => {
    const acumar = REPORTES.find((r) => r.id === "mensual-acumar");
    expect(acumar && nombreDelReporte(acumar)).toBe(
      "ACUMAR - Plantilla mensual clásica",
    );
  });

  it("el nombre lleva el emisor y el tipo, y la versión solo en la nueva", () => {
    expect(nombreDelReporte(REPORTES[0])).toBe(
      "APrA - Plantilla mensual clásica",
    );
    expect(nombreDelReporte(REPORTES[1])).toMatch(
      /^APrA - Plantilla mensual nueva v\d+\.\d+$/,
    );
  });
});

describe("pedidoDe (la URL de /reportes)", () => {
  const base = { estacion: "centenario", contaminante: "co", mes: "2026-09" };

  it("un mensual completo", () => {
    expect(pedidoDe({ reporte: "mensual-nuevo", ...base })).toEqual({
      tipo: "mensual",
      reporte: {
        id: "mensual-nuevo",
        emisor: "APrA",
        tipo: "mensual",
        plantilla: "nuevo",
      },
      filtros: base,
    });
  });

  it("si el parámetro viene repetido, toma el primero", () => {
    expect(
      pedidoDe({ reporte: ["mensual-clasico", "mensual-nuevo"], ...base })
        ?.reporte.id,
    ).toBe("mensual-clasico");
  });

  it.each([
    ["sin reporte", base],
    ["con un reporte que no existe", { reporte: "anual", ...base }],
    [
      "sin mes",
      { reporte: "mensual-nuevo", estacion: "centenario", contaminante: "co" },
    ],
    [
      "con una estación fuera de la lista",
      { ...base, reporte: "mensual-nuevo", estacion: "cifa" },
    ],
    [
      "con un mes mal escrito",
      { ...base, reporte: "mensual-nuevo", mes: "2026-9" },
    ],
  ])("nada %s: no hay vista previa", (_, params) => {
    expect(pedidoDe(params)).toBeNull();
  });
});
