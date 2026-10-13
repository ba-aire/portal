import { describe, expect, it } from "vitest";
import {
  etiquetaHora,
  HORAS_DESDE,
  HORAS_HASTA,
  ventanaMinutal,
} from "@/lib/rango-minutal";

describe("ventanaMinutal", () => {
  const dia = new Date(2026, 9, 13); // medianoche local, como la entrega el calendario

  it("arma la franja de horas dentro del día", () => {
    const { start, end } = ventanaMinutal(dia, 8, 18);

    expect(start).toEqual(new Date(2026, 9, 13, 8));
    expect(end).toEqual(new Date(2026, 9, 13, 18));
  });

  it("sin horas trae el día completo", () => {
    const { start, end } = ventanaMinutal(dia);

    expect(start).toEqual(new Date(2026, 9, 13, 0));
    expect(end).toEqual(new Date(2026, 9, 14, 0));
  });

  it('la hora "hasta" 24 es la medianoche del día siguiente (exclusiva)', () => {
    const { end } = ventanaMinutal(dia, 0, 24);

    expect(end).toEqual(new Date(2026, 9, 14, 0));
  });

  it("ignora la hora que traiga el día recibido", () => {
    const { start } = ventanaMinutal(new Date(2026, 9, 13, 15, 30), 2, 3);

    expect(start).toEqual(new Date(2026, 9, 13, 2));
  });

  it("nunca supera el tope de un día", () => {
    const { start, end } = ventanaMinutal(dia, 0, 24);

    expect(end.getTime() - start.getTime()).toBeLessThanOrEqual(
      24 * 60 * 60 * 1000,
    );
  });
});

describe("opciones de hora", () => {
  it('"desde" va de 0 a 23 y "hasta" de 1 a 24', () => {
    expect(HORAS_DESDE[0]).toBe(0);
    expect(HORAS_DESDE.at(-1)).toBe(23);
    expect(HORAS_HASTA[0]).toBe(1);
    expect(HORAS_HASTA.at(-1)).toBe(24);
  });

  it("formatea con dos dígitos", () => {
    expect(etiquetaHora(8)).toBe("08:00");
    expect(etiquetaHora(24)).toBe("24:00");
  });
});
