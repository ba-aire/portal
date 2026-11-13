import { describe, expect, it } from "vitest";
import {
  etiquetaSerie,
  formatearInstante,
  localAIso,
  nombreEquipo,
  opcionesDeSerie,
  serieDeOpcion,
} from "@/lib/revision/presentacion";

const PARAMETROS = [
  { parameter_code: "co", display_name: "CO", measurement: "co" },
  { parameter_code: "no", display_name: "NO", measurement: "nox" },
  { parameter_code: "no2", display_name: "NO₂", measurement: "nox" },
  { parameter_code: "nox", display_name: "NOx", measurement: "nox" },
];

describe("opcionesDeSerie", () => {
  it("ofrece como equipo solo los que miden más de un parámetro", () => {
    const o = opcionesDeSerie(PARAMETROS);
    expect(o.equipos).toEqual([
      { value: "m:nox", label: "Equipo NOx (no, no2, nox)" },
    ]);
    expect(o.parametros.map((p) => p.value)).toEqual([
      "p:co",
      "p:no",
      "p:no2",
      "p:nox",
    ]);
  });
});

describe("serieDeOpcion", () => {
  it.each([
    ["m:nox", { parameter_code: null, measurement: "nox" }],
    ["p:no2", { parameter_code: "no2", measurement: null }],
    ["", { parameter_code: null, measurement: null }],
  ])("%j", (valor, esperado) => {
    expect(serieDeOpcion(valor)).toEqual(esperado);
  });
});

describe("etiquetaSerie", () => {
  it("un equipo, por su nombre", () => {
    expect(
      etiquetaSerie({ parameter_code: null, measurement: "nox" }, PARAMETROS),
    ).toBe("Equipo NOx");
  });
  it("un parámetro, por su display_name", () => {
    expect(
      etiquetaSerie({ parameter_code: "no2", measurement: null }, PARAMETROS),
    ).toBe("NO₂");
  });
  it("un parámetro fuera del catálogo, por su código", () => {
    expect(etiquetaSerie({ parameter_code: "zz", measurement: null }, [])).toBe(
      "zz",
    );
    expect(etiquetaSerie({ parameter_code: null, measurement: null }, [])).toBe(
      "",
    );
  });
});

describe("nombreEquipo", () => {
  it("usa el nombre conocido o el código", () => {
    expect(nombreEquipo("pm25")).toBe("PM2.5");
    expect(nombreEquipo("nuevo")).toBe("nuevo");
  });
});

describe("localAIso y formatearInstante", () => {
  it("convierte la hora local del input a ISO y vuelve", () => {
    const iso = localAIso("2026-11-10T14:30");
    expect(iso).toBe(new Date(2026, 10, 10, 14, 30).toISOString());
    expect(formatearInstante(iso as string)).toContain("14:30");
    expect(formatearInstante(iso as string)).toContain("10/11/2026");
  });
  it.each(["", "no-es-fecha"])("%j es null", (v) => {
    expect(localAIso(v)).toBeNull();
  });
});
