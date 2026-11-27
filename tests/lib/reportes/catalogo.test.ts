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

  it("el mensual, en sus plantillas visibles (la nueva está oculta)", () => {
    expect(reporteDe("mensual-clasico")).toMatchObject({
      tipo: "mensual",
      plantilla: "clasico",
    });
    expect(reporteDe("mensual-acumar")?.plantilla).toBe("acumar");
    expect(reporteDe("mensual-nuevo")).toBeNull();
    expect(reporteDe("anual")).toBeNull();
    expect(reporteDe(undefined)).toBeNull();
  });

  it("en el select se agrupan por tipo", () => {
    const grupos = reportesPorTipo();
    expect(grupos.map((g) => g.tipo)).toEqual(["mensual"]);
    expect(grupos[0].reportes.map((r) => r.id)).toEqual([
      "mensual-clasico",
      "mensual-acumar",
    ]);
  });

  it("la de ACUMAR es la clásica con otro emisor", () => {
    const acumar = REPORTES.find((r) => r.id === "mensual-acumar");
    expect(acumar && nombreDelReporte(acumar)).toBe("ACUMAR - Reporte Mensual");
  });

  it("el nombre lleva el emisor y el tipo", () => {
    expect(nombreDelReporte(REPORTES[0])).toBe("APrA - Reporte Mensual");
  });
});

describe("pedidoDe (la URL de /reportes)", () => {
  const base = { estacion: "centenario", contaminante: "co", mes: "2026-09" };

  it("un mensual completo", () => {
    expect(pedidoDe({ reporte: "mensual-acumar", ...base })).toEqual({
      tipo: "mensual",
      reporte: {
        id: "mensual-acumar",
        emisor: "ACUMAR",
        tipo: "mensual",
        plantilla: "acumar",
      },
      filtros: base,
    });
  });

  it("si el parámetro viene repetido, toma el primero", () => {
    expect(
      pedidoDe({ reporte: ["mensual-clasico", "mensual-acumar"], ...base })
        ?.reporte.id,
    ).toBe("mensual-clasico");
  });

  it.each([
    ["sin reporte", base],
    ["con la plantilla nueva, oculta", { reporte: "mensual-nuevo", ...base }],
    ["con un reporte que no existe", { reporte: "anual", ...base }],
    [
      "sin mes",
      {
        reporte: "mensual-clasico",
        estacion: "centenario",
        contaminante: "co",
      },
    ],
    [
      "con una estación fuera de la lista",
      { ...base, reporte: "mensual-clasico", estacion: "cifa" },
    ],
    [
      "con un mes mal escrito",
      { ...base, reporte: "mensual-clasico", mes: "2026-9" },
    ],
  ])("nada %s: no hay vista previa", (_, params) => {
    expect(pedidoDe(params)).toBeNull();
  });
});
