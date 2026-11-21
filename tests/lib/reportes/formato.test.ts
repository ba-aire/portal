import { describe, expect, it } from "vitest";
import {
  celda,
  celdaHora,
  etapaDe,
  etiquetaHora,
  menorQueLD,
  nombreVentana,
  numero,
  ORDEN_HORAS_PERFIL,
  redondear,
  sinSubindices,
  textoLimite,
  unidadImpresa,
} from "@/lib/reportes/formato";
import type { Excedencia } from "@/lib/reportes/models";

describe("redondear y numero", () => {
  // Como ROUND de Excel, que es contra lo que se compara la planilla.
  it.each([
    [0.25, 1, 0.3],
    [-0.25, 1, -0.3],
    [1.005, 2, 1.01],
    [2.5, 0, 3],
    [0.349, 1, 0.3],
  ])("redondear(%d, %d) = %d", (v, d, r) => {
    expect(redondear(v, d)).toBe(r);
  });

  it("escribe con coma decimal y sin separador de miles", () => {
    expect(numero(0.3, 1)).toBe("0,3");
    expect(numero(1234.56, 0)).toBe("1235");
    expect(numero(2, 1)).toBe("2,0");
  });

  it("un negativo chiquito no lleva signo", () => {
    expect(numero(-0.04, 1)).toBe("0,0");
  });

  it("vacío si no hay valor", () => {
    expect(numero(null, 1)).toBe("");
    expect(numero(Number.NaN, 1)).toBe("");
  });
});

describe("celdas", () => {
  it("un promedio: el número, o SD / DND", () => {
    expect(celda(0.46, "ok", 1)).toBe("0,5");
    expect(celda(null, "SD", 1)).toBe("SD");
    expect(celda(null, "DND", 1)).toBe("DND");
    expect(celda(null, "ok", 1)).toBe("");
  });

  it("una hora por debajo del límite de detección sale <LD", () => {
    expect(celdaHora(0.3, "ok", 0.4, 0)).toBe("<0,4");
    expect(celdaHora(0.4, "ok", 0.4, 0)).toBe("0");
    expect(celdaHora(3, "ok", 4.8, 0)).toBe("<4,8");
  });

  it("una hora sin límite relevado sale como número", () => {
    expect(celdaHora(0.3, "ok", null, 1)).toBe("0,3");
  });

  it("una hora sin dato sale SD / DND", () => {
    expect(celdaHora(null, "SD", 0.4, 0)).toBe("SD");
    expect(celdaHora(null, "DND", 0.4, 0)).toBe("DND");
    expect(celdaHora(null, "ok", 0.4, 0)).toBe("");
  });

  it("menorQueLD con hasta dos decimales", () => {
    expect(menorQueLD(0.04)).toBe("<0,04");
    expect(menorQueLD(4)).toBe("<4");
  });
});

describe("rótulos", () => {
  it("la hora se rotula por su inicio, como intervalo", () => {
    expect(etiquetaHora(23)).toBe("23:00 a 00:00");
    expect(etiquetaHora(0)).toBe("00:00 a 01:00");
  });

  it("el perfil empieza en 23 y termina en 22, como la planilla", () => {
    expect(ORDEN_HORAS_PERFIL).toHaveLength(24);
    expect(ORDEN_HORAS_PERFIL[0]).toBe(23);
    expect(ORDEN_HORAS_PERFIL[1]).toBe(0);
    expect(ORDEN_HORAS_PERFIL[23]).toBe(22);
  });

  it("sin subíndices ni unidades de base", () => {
    expect(sinSubindices("NO₂ y PM₂.₅")).toBe("NO2 y PM2.5");
    expect(sinSubindices("NOₓ")).toBe("NOx");
    expect(unidadImpresa("ug/m3")).toBe("µg/m³");
    expect(unidadImpresa("ppm")).toBe("PPM");
    expect(unidadImpresa("indice")).toBe("indice");
  });

  it("la etapa de la Res. 68", () => {
    expect(etapaDe("Res. 68/APRA/21 Anexo I (etapa 3)")).toBe("3ra etapa");
    expect(etapaDe("Res. 68/APRA/21 Anexo I (etapa 2)")).toBe("2da etapa");
    expect(etapaDe("Res. 68/APRA/21 Anexo I (etapa 7)")).toBe("7° etapa");
    expect(etapaDe("Dec. 198")).toBeNull();
  });

  const exc = (
    w: Excedencia["window_code"],
    m: boolean,
    limite = 9,
    norma = "Res. 68/APRA/21 Anexo I (etapa 3)",
  ): Excedencia => ({
    parameter_code: "co",
    norma,
    cita: "",
    window_code: w,
    is_moving: m,
    periodo_publicado: "",
    limite,
    unidad: "ppm",
    forma_cumplimiento: null,
    n_evaluados: 1,
    n_excedencias: 0,
    maximo: null,
  });

  it("el nombre de cada ventana", () => {
    expect(nombreVentana(exc("8h", true))).toBe("Promedios móviles 8 hs");
    expect(nombreVentana(exc("8h", false))).toBe("Promedios 8 hs");
    expect(nombreVentana(exc("24h", false))).toBe("Promedios 24 hs");
    expect(nombreVentana(exc("1h", false))).toBe("Promedios 1 hora");
  });

  it("el texto del límite, con y sin parámetro", () => {
    expect(textoLimite(exc("8h", true), "CO", false)).toBe(
      "Promedios móviles 8 hs: 9 PPM (Res. 68/APRA/21, 3ra etapa)",
    );
    expect(
      textoLimite(exc("1h", false, 0.5, "Res. 68/APRA/21"), "NO2", true),
    ).toBe("Promedios 1 hora de NO2: 0,5 PPM (Res. 68/APRA/21)");
  });
});
