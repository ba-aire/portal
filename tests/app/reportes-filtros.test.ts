// El filtro de mes del reporte mensual (MonthPicker): en castellano, sin
// meses futuros y con diez años hacia atrás; y cómo se nombra cada plantilla.
import { describe, expect, it } from "vitest";
import {
  mesAnterior,
  primerMes,
} from "@/app/(main)/reportes/components/filtros-mensual";
import {
  etiquetaMes,
  MESES,
  mesActual,
  mesEnRango,
} from "@/components/month-picker";
import { etiquetaPlantilla } from "@/lib/reportes/config";

const hoy = new Date(2026, 10, 21); // 21 de noviembre de 2026

describe("filtro de mes del reporte mensual", () => {
  it("por defecto, el mes anterior (el que se publica)", () => {
    expect(mesAnterior(hoy)).toBe("2026-10");
    expect(mesAnterior(new Date(2026, 0, 5))).toBe("2025-12");
  });

  it("ofrece diez años hacia atrás", () => {
    expect(primerMes(hoy)).toBe("2017-01");
  });
});

describe("MonthPicker", () => {
  it("los doce meses, en castellano", () => {
    expect(MESES).toHaveLength(12);
    expect(etiquetaMes("2026-09")).toBe("Septiembre 2026");
    expect(etiquetaMes("2025-01")).toBe("Enero 2025");
  });

  it("hasta el mes en curso: lo futuro no se ofrece", () => {
    const hasta = mesActual(hoy);
    expect(hasta).toBe("2026-11");
    expect(mesEnRango("2026-11", "2017-01", hasta)).toBe(true);
    expect(mesEnRango("2026-12", "2017-01", hasta)).toBe(false);
    expect(mesEnRango("2016-12", "2017-01", hasta)).toBe(false);
    expect(mesEnRango("2017-01", "2017-01", hasta)).toBe(true);
  });
});

describe("nombre de cada plantilla en el selector", () => {
  it("la clásica, solo el nombre; la nueva, con su versión", () => {
    expect(etiquetaPlantilla("clasico")).toBe("Clásica");
    expect(etiquetaPlantilla("nuevo")).toMatch(/^Nueva v\d+\.\d+$/);
  });
});
