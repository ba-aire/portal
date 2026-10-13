// Que muestra /datos del resultado ya traido: filtrado por status del minuto, y
// silver/gold por hora y por dia. Si esto se equivoca, la pantalla muestra un
// span de calibracion como si fuera atmosfera, o esconde gold sin avisar.
import { describe, expect, it } from "vitest";
import {
  FUENTES_INICIAL,
  filtrarSeries,
  ordenarSeries,
  STATUS_MINUTO,
  SUFIJO_STATUS,
  serieBase,
  seriesDe,
  seriesDeUnaFuente,
} from "@/lib/datos/series";

const TODOS = new Set(STATUS_MINUTO.map((s) => s.value));
const NINGUNA = FUENTES_INICIAL;
const TODAS = { crudo: true, conAlarmas: true, sinAlarmas: true };

type Fila = Record<string, string | number | null>;

const MINUTOS: Fila[] = [
  { time: "t0", centenario: 0.5, [`centenario${SUFIJO_STATUS}`]: "ok" },
  { time: "t1", centenario: 40, [`centenario${SUFIJO_STATUS}`]: "span" },
  { time: "t2", centenario: 0.6, [`centenario${SUFIJO_STATUS}`]: "alarm" },
];

const HORAS: Fila[] = [
  {
    time: "h0",
    "centenario (validados)": 0.5,
    "centenario (crudo)": 0.9,
    "centenario (crudo con alarmas)": 0.6,
    "centenario (crudo sin alarmas)": 0.5,
  },
  // Hora invalida para gold (< 75 %): no trae validados, si las crudas.
  { time: "h1", "centenario (crudo)": 0.7 },
];

describe("filtrarSeries", () => {
  describe("por minuto", () => {
    it("con todos los status elegidos muestra todo, sin las columnas de status", () => {
      const r = filtrarSeries(MINUTOS, "minute", {
        statuses: TODOS,
        fuentes: NINGUNA,
      });

      expect(r).toEqual([
        { time: "t0", centenario: 0.5 },
        { time: "t1", centenario: 40 },
        { time: "t2", centenario: 0.6 },
      ]);
    });

    it("pone en null (no saca la fila) los minutos de un status no elegido", () => {
      const r = filtrarSeries(MINUTOS, "minute", {
        statuses: new Set(["ok", "alarm"]),
        fuentes: NINGUNA,
      });

      expect(r[1]).toEqual({ time: "t1", centenario: null });
      expect(r).toHaveLength(3);
    });
  });

  describe("por hora", () => {
    it("por defecto muestra solo los validados", () => {
      const r = filtrarSeries(HORAS, "hour", {
        statuses: TODOS,
        fuentes: NINGUNA,
      });

      expect(r).toEqual([
        { time: "h0", "centenario (validados)": 0.5 },
        { time: "h1" },
      ]);
    });

    it("prende las crudas de a una", () => {
      const r = filtrarSeries(HORAS, "hour", {
        statuses: TODOS,
        fuentes: { ...NINGUNA, conAlarmas: true },
      });

      expect(r[0]).toEqual({
        time: "h0",
        "centenario (validados)": 0.5,
        "centenario (crudo con alarmas)": 0.6,
      });
    });

    it("con las tres crudas prendidas muestra las cuatro columnas", () => {
      const r = filtrarSeries(HORAS, "hour", {
        statuses: TODOS,
        fuentes: TODAS,
      });

      expect(Object.keys(r[0])).toHaveLength(5); // time + 4
      expect(r[1]).toEqual({ time: "h1", "centenario (crudo)": 0.7 });
    });

    it("en las medias moviles solo hay validados, vengan como vengan los flags", () => {
      const moviles: Fila[] = [{ time: "m0", "centenario (validados)": 0.4 }];

      expect(
        filtrarSeries(moviles, "mov8h", { statuses: TODOS, fuentes: TODAS }),
      ).toEqual(moviles);
    });

    it("no filtra por status fuera del intervalo por minuto", () => {
      const r = filtrarSeries(HORAS, "hour", {
        statuses: new Set(),
        fuentes: TODAS,
      });

      expect(r[1]).toEqual({ time: "h1", "centenario (crudo)": 0.7 });
    });
  });
});

describe("seriesDe / serieBase", () => {
  it("lista las series sin las columnas de status", () => {
    expect(seriesDe(MINUTOS)).toEqual(["centenario"]);
  });

  it("todas las fuentes comparten base (y color) con la serie por minuto", () => {
    expect(serieBase("cordoba NO2 (validados)")).toBe("cordoba NO2");
    expect(serieBase("cordoba NO2 (crudo)")).toBe("cordoba NO2");
    expect(serieBase("cordoba NO2 (crudo con alarmas)")).toBe("cordoba NO2");
    expect(serieBase("cordoba NO2 (crudo sin alarmas)")).toBe("cordoba NO2");
    expect(serieBase("cordoba NO2")).toBe("cordoba NO2");
  });
});

describe("ordenarSeries", () => {
  it("deja cada serie con sus fuentes juntas: validados y despues las crudas", () => {
    expect(
      ordenarSeries([
        "cordoba (crudo sin alarmas)",
        "cordoba (crudo)",
        "centenario (crudo con alarmas)",
        "cordoba (validados)",
        "centenario (validados)",
      ]),
    ).toEqual([
      "centenario (validados)",
      "centenario (crudo con alarmas)",
      "cordoba (validados)",
      "cordoba (crudo)",
      "cordoba (crudo sin alarmas)",
    ]);
  });
});

describe("seriesDeUnaFuente", () => {
  it("para apilar prefiere validados", () => {
    expect(
      seriesDeUnaFuente([
        "centenario NO (validados)",
        "centenario NO (crudo)",
        "centenario NO2 (validados)",
      ]),
    ).toEqual(["centenario NO (validados)", "centenario NO2 (validados)"]);
  });

  it("sin validados usa la primera cruda, nunca varias", () => {
    expect(
      seriesDeUnaFuente([
        "centenario NO (crudo sin alarmas)",
        "centenario NO (crudo)",
      ]),
    ).toEqual(["centenario NO (crudo)"]);
  });

  it("por minuto (sin fuente) devuelve todas", () => {
    expect(seriesDeUnaFuente(["centenario NO", "centenario NO2"])).toEqual([
      "centenario NO",
      "centenario NO2",
    ]);
  });
});
