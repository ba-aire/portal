import { describe, expect, it } from "vitest";
import {
  CLASE_FONDO_OTRA,
  CODIGOS_ESTACION,
  COLOR_OTRA,
  claseFondoEstacion,
  colorSerie,
  ESTACIONES,
  EstacionEnum,
  esEstacion,
  nombreEstacion,
  nombreSerie,
  OPCIONES_ESTACION,
  urlEstacion,
} from "@/lib/estaciones";

describe("lib/estaciones", () => {
  it("tiene las cuatro estaciones de airedb, en el orden del menú", () => {
    expect(CODIGOS_ESTACION).toEqual([
      "centenario",
      "catalinas",
      "cordoba",
      "cifa",
    ]);
    expect(Object.keys(ESTACIONES).sort()).toEqual(
      [...CODIGOS_ESTACION].sort(),
    );
  });

  it("nombra a cada estación como la conoce la gente, no por su código", () => {
    expect(CODIGOS_ESTACION.map((c) => ESTACIONES[c].nombre)).toEqual([
      "Centenario",
      "La Boca",
      "Córdoba",
      "CIFA",
    ]);
    expect(ESTACIONES.centenario.nombreLargo).toBe("Parque Centenario");
    expect(ESTACIONES.catalinas.nombreLargo).toBe("La Boca");
  });

  // Tailwind solo genera las clases que encuentra escritas enteras en el código.
  it("usa las clases de fondo sobre los --color-* de globals.css", () => {
    for (const codigo of CODIGOS_ESTACION) {
      expect(ESTACIONES[codigo].claseFondo).toBe(`bg-${codigo}`);
    }
  });

  describe("EstacionEnum", () => {
    it("acepta los cuatro códigos", () => {
      for (const codigo of CODIGOS_ESTACION) {
        expect(EstacionEnum.parse(codigo)).toBe(codigo);
      }
    });

    it("rechaza un nombre visible o algo que no es una estación", () => {
      expect(EstacionEnum.safeParse("La Boca").success).toBe(false);
      expect(EstacionEnum.safeParse("CENTENARIO").success).toBe(false);
      expect(EstacionEnum.safeParse("'; DROP TABLE x").success).toBe(false);
    });
  });

  it("esEstacion distingue códigos válidos", () => {
    expect(esEstacion("cifa")).toBe(true);
    expect(esEstacion("otra")).toBe(false);
    expect(esEstacion("")).toBe(false);
  });

  it("nombreEstacion devuelve el nombre corto, o el código si no lo conoce", () => {
    expect(nombreEstacion("catalinas")).toBe("La Boca");
    expect(nombreEstacion("cordoba")).toBe("Córdoba");
    expect(nombreEstacion("palermo")).toBe("palermo");
  });

  it("claseFondoEstacion cae en bg-otra para una estación desconocida", () => {
    expect(claseFondoEstacion("cifa")).toBe("bg-cifa");
    expect(claseFondoEstacion("palermo")).toBe(CLASE_FONDO_OTRA);
  });

  it("arma las opciones de los filtros con código y nombre", () => {
    expect(OPCIONES_ESTACION).toEqual([
      { label: "Centenario", value: "centenario" },
      { label: "La Boca", value: "catalinas" },
      { label: "Córdoba", value: "cordoba" },
      { label: "CIFA", value: "cifa" },
    ]);
  });

  it("urlEstacion apunta a la página en vivo", () => {
    expect(urlEstacion("catalinas")).toBe("/estaciones/catalinas");
  });

  describe("nombreSerie", () => {
    it("cambia el código del principio por el nombre y conserva el resto", () => {
      expect(nombreSerie("catalinas")).toBe("La Boca");
      expect(nombreSerie("catalinas NO2")).toBe("La Boca NO2");
      expect(nombreSerie("cordoba PM25 (crudo)")).toBe("Córdoba PM25 (crudo)");
      expect(nombreSerie("cifa (validados)")).toBe("CIFA (validados)");
    });

    it("solo reconoce el código entero, no un prefijo", () => {
      expect(nombreSerie("cifas")).toBe("Cifas");
      expect(nombreSerie("catalinas_raw")).toBe("Catalinas_raw");
    });

    it("lo que no es una estación sale con la inicial en mayúscula", () => {
      expect(nombreSerie("co")).toBe("Co");
      expect(nombreSerie("no2_status")).toBe("No2_status");
      expect(nombreSerie("")).toBe("");
    });
  });

  describe("colorSerie", () => {
    it("usa el color de la estación para la serie sin parámetro", () => {
      expect(colorSerie("centenario")).toBe("var(--color-centenario)");
    });

    it("usa el color del parámetro en la estación cuando globals.css lo tiene", () => {
      expect(colorSerie("cordoba NO")).toBe("var(--color-cordoba-no)");
      expect(colorSerie("catalinas NOx")).toBe("var(--color-catalinas-nox)");
      expect(colorSerie("cifa PM25")).toBe("var(--color-cifa-pm25)");
      expect(colorSerie("centenario PM10")).toBe(
        "var(--color-centenario-pm10)",
      );
    });

    it("cae en --color-otra para un parámetro sin color o una estación desconocida", () => {
      expect(colorSerie("centenario O3")).toBe(COLOR_OTRA);
      expect(colorSerie("otra")).toBe(COLOR_OTRA);
      expect(colorSerie("palermo NO2")).toBe(COLOR_OTRA);
    });
  });
});
