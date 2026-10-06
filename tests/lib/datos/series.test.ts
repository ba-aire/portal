// Que muestra /datos del resultado ya traido: filtrado por status del minuto, y
// silver/gold por hora y por dia. Si esto se equivoca, la pantalla muestra un
// span de calibracion como si fuera atmosfera, o esconde gold sin avisar.
import { describe, expect, it } from "vitest";
import {
  filtrarSeries,
  ordenarSeries,
  STATUS_MINUTO,
  SUFIJO_GOLD,
  SUFIJO_STATUS,
  serieBase,
  seriesDe,
} from "@/lib/datos/series";

const TODOS = new Set(STATUS_MINUTO.map((s) => s.value));
const AMBAS = { silver: true, gold: true };

type Fila = Record<string, string | number | null>;

const MINUTOS: Fila[] = [
  { time: "t0", centenario: 0.5, [`centenario${SUFIJO_STATUS}`]: "ok" },
  { time: "t1", centenario: 40, [`centenario${SUFIJO_STATUS}`]: "span" },
  { time: "t2", centenario: 0.6, [`centenario${SUFIJO_STATUS}`]: "alarm" },
];

const HORAS: Fila[] = [
  { time: "h0", centenario: 0.5, [`centenario${SUFIJO_GOLD}`]: 0.5 },
  // Hora invalida para gold (< 75 %): no trae la serie de gold.
  { time: "h1", centenario: 0.7 },
];

describe("filtrarSeries", () => {
  describe("por minuto", () => {
    it("con todos los status elegidos muestra todo, sin las columnas de status", () => {
      const r = filtrarSeries(MINUTOS, "minute", {
        statuses: TODOS,
        fuentes: AMBAS,
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
        fuentes: AMBAS,
      });

      expect(r[1]).toEqual({ time: "t1", centenario: null });
      expect(r).toHaveLength(3);
    });
  });

  describe("por hora", () => {
    it("muestra silver y gold", () => {
      const r = filtrarSeries(HORAS, "hour", {
        statuses: TODOS,
        fuentes: AMBAS,
      });

      expect(r[0]).toEqual({
        time: "h0",
        centenario: 0.5,
        "centenario (gold)": 0.5,
      });
    });

    it("sin silver queda solo gold, y viceversa", () => {
      const soloGold = filtrarSeries(HORAS, "hour", {
        statuses: TODOS,
        fuentes: { silver: false, gold: true },
      });
      const soloSilver = filtrarSeries(HORAS, "day", {
        statuses: TODOS,
        fuentes: { silver: true, gold: false },
      });

      expect(soloGold[0]).toEqual({ time: "h0", "centenario (gold)": 0.5 });
      expect(soloSilver[0]).toEqual({ time: "h0", centenario: 0.5 });
    });

    it("no filtra por status fuera del intervalo por minuto", () => {
      const r = filtrarSeries(HORAS, "hour", {
        statuses: new Set(),
        fuentes: AMBAS,
      });

      expect(r[1]).toEqual({ time: "h1", centenario: 0.7 });
    });
  });
});

describe("seriesDe / serieBase", () => {
  it("lista las series sin las columnas de status", () => {
    expect(seriesDe(MINUTOS)).toEqual(["centenario"]);
  });

  it("la serie de gold comparte base (y color) con la de silver", () => {
    expect(serieBase("cordoba NO2 (gold)")).toBe("cordoba NO2");
    expect(serieBase("cordoba NO2")).toBe("cordoba NO2");
  });
});

describe("ordenarSeries", () => {
  it("deja cada serie seguida de su version de gold, sin importar como llegaron", () => {
    expect(
      ordenarSeries([
        "cordoba (gold)",
        "cordoba",
        "centenario (gold)",
        "centenario",
      ]),
    ).toEqual(["centenario", "centenario (gold)", "cordoba", "cordoba (gold)"]);
  });
});
