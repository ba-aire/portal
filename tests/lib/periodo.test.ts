import { describe, expect, it } from "vitest";
import {
  encabezadoPeriodo,
  formatInstanteCorto,
  formatNumero,
  formatPeriodo,
} from "@/lib/periodo";

// airedb rotula por el INICIO del período, en UTC; el portal muestra hora
// argentina (UTC-3) y, para la hora, el rango [inicio, fin) que cubre.
describe("formatPeriodo", () => {
  it("muestra la hora como el rango que cubre", () => {
    expect(formatPeriodo("2026-10-14T17:00:00Z", "hour")).toBe(
      "14/10/2026, 14:00 a 15:00 hs",
    );
  });

  it("cierra en 00:00 la última hora del día, sin pasar a 24:00", () => {
    expect(formatPeriodo("2026-10-15T02:00:00Z", "hour")).toBe(
      "14/10/2026, 23:00 a 00:00 hs",
    );
  });

  it("muestra el minuto con su inicio", () => {
    expect(formatPeriodo("2026-10-14T17:05:00Z", "minute")).toBe(
      "14/10/2026, 14:05",
    );
  });

  // /datos ya ubica la móvil en window_end: se muestra ese instante, sin rango.
  it("muestra la móvil en el fin de su ventana", () => {
    expect(formatPeriodo("2026-10-15T11:00:00Z", "mov24h")).toBe(
      "15/10/2026, 08:00",
    );
  });

  it("devuelve tal cual lo que no es una fecha", () => {
    expect(formatPeriodo("s/d", "hour")).toBe("s/d");
  });
});

describe("encabezadoPeriodo", () => {
  it("aclara que el minuto se rotula por su inicio", () => {
    expect(encabezadoPeriodo("minute")).toBe(
      "Fecha y hora (inicio del minuto)",
    );
    expect(encabezadoPeriodo("hour")).toBe("Fecha y Hora");
    expect(encabezadoPeriodo("mov8h")).toBe(
      "Fecha y hora (fin de las últimas 8 h)",
    );
  });
});

describe("formatInstanteCorto", () => {
  it("rotula el eje con día/mes y hora de 24 hs, en hora argentina", () => {
    expect(formatInstanteCorto("2026-11-21T11:00:00Z")).toBe("21/11, 08:00");
    expect(formatInstanteCorto("2026-11-21T20:30:00Z")).toBe("21/11, 17:30");
  });

  it("muestra la medianoche como 00:00, no 24:00 ni 12 a. m.", () => {
    expect(formatInstanteCorto("2026-11-22T03:00:00Z")).toBe("22/11, 00:00");
  });

  it("devuelve tal cual lo que no es una fecha", () => {
    expect(formatInstanteCorto("s/d")).toBe("s/d");
  });
});

describe("formatNumero", () => {
  it("usa coma decimal y punto de miles, sin ceros de relleno", () => {
    expect(formatNumero(2.25)).toBe("2,25");
    expect(formatNumero(1234.5)).toBe("1.234,5");
    expect(formatNumero(40)).toBe("40");
  });

  it("corta en los decimales pedidos", () => {
    expect(formatNumero(0.123456)).toBe("0,123");
    expect(formatNumero(0.123456, 1)).toBe("0,1");
  });
});
