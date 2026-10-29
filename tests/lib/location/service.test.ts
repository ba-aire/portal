// @vitest-environment node
//
// applyFreshnessCheck es la última barrera antes de que el dato salga por el
// SSE hacia el panel: decide qué se muestra y qué se anula por viejo. Un fallo
// acá no rompe nada visible — simplemente el dashboard muestra como actual la
// medición de un analizador que dejó de reportar hace horas.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FullLocationData } from "@/lib/location/models";
import { applyFreshnessCheck } from "@/lib/location/service";

const AHORA = new Date("2026-01-01T12:00:00.000Z");

/** Fecha a N minutos antes de AHORA. */
function haceMinutos(minutos: number): Date {
  return new Date(AHORA.getTime() - minutos * 60 * 1000);
}

/**
 * Estación con todos los instrumentos reportando. Por defecto todo reciente:
 * cada test envejece sólo el timestamp que le interesa.
 */
function estacion(
  timestamps: Partial<FullLocationData["timestamps"]> = {},
): FullLocationData {
  const reciente = haceMinutos(1);
  return {
    location: "cifa",
    timestamps: {
      co: reciente,
      nox: reciente,
      o3: reciente,
      so2: reciente,
      pm10: reciente,
      pm25: reciente,
      meteo: reciente,
      ...timestamps,
    },
    latest_time: reciente,
    co_mean: 1,
    co_mean_status: "k",
    no_mean: 2,
    no2_mean: 3,
    nox_mean: 4,
    nox_mean_status: "k",
    o3_mean: 5,
    o3_mean_status: "k",
    so2_mean: 6,
    so2_mean_status: "k",
    pm10_mean: 7,
    pm10_mean_status: "k",
    pm25_mean: 8,
    pm25_mean_status: "k",
    dv_mean: 90,
    hr_in_mean: 40,
    hr_mean: 50,
    lluvia_mean: 0,
    temp_mean: 20,
    temp_in_mean: 22,
    vv_mean: 3,
    pa_mean: 1013,
    rs_mean: 800,
    uv_mean: 5,
  };
}

describe("applyFreshnessCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("clasificación", () => {
    it("marca como fresh un dato del minuto anterior", () => {
      const r = applyFreshnessCheck(estacion());

      expect(r.freshness.co).toBe("fresh");
    });

    // El umbral es 4 minutos con corte `<=`: a los 4 exactos todavía es válido.
    // Correrlo a `<` deja en blanco el panel cada vez que un analizador se
    // atrasa un minuto, que es normal en la red.
    it("mantiene fresh el dato de exactamente 4 minutos", () => {
      const r = applyFreshnessCheck(estacion({ co: haceMinutos(4) }));

      expect(r.freshness.co).toBe("fresh");
      expect(r.co_mean).toBe(1);
    });

    it("marca como stale a partir del quinto minuto", () => {
      const r = applyFreshnessCheck(estacion({ co: haceMinutos(5) }));

      expect(r.freshness.co).toBe("stale");
    });

    it("marca como stale un instrumento sin timestamp", () => {
      const r = applyFreshnessCheck(estacion({ so2: null }));

      expect(r.freshness.so2).toBe("stale");
    });
  });

  describe("anulación de valores vencidos", () => {
    // Mostrar el último valor conocido de un analizador caído es peor que no
    // mostrar nada: el operador lo lee como la medición actual de la estación.
    it("anula el valor y el status del contaminante vencido", () => {
      const r = applyFreshnessCheck(estacion({ co: haceMinutos(10) }));

      expect(r.co_mean).toBeNull();
      expect(r.co_mean_status).toBeNull();
    });

    it("anula las tres especies cuando vence el analizador de NOx", () => {
      const r = applyFreshnessCheck(estacion({ nox: haceMinutos(10) }));

      // Salen del mismo instrumento: si venció, vencieron las tres.
      expect(r.no_mean).toBeNull();
      expect(r.no2_mean).toBeNull();
      expect(r.nox_mean).toBeNull();
      expect(r.nox_mean_status).toBeNull();
    });

    it("no toca los instrumentos que siguen reportando", () => {
      const r = applyFreshnessCheck(estacion({ co: haceMinutos(10) }));

      expect(r.o3_mean).toBe(5);
      expect(r.pm25_mean).toBe(8);
      expect(r.freshness.o3).toBe("fresh");
    });

    it.each([
      ["o3", "o3_mean"],
      ["so2", "so2_mean"],
      ["pm10", "pm10_mean"],
      ["pm25", "pm25_mean"],
    ])("anula %s cuando vence", (clave, campo) => {
      const r = applyFreshnessCheck(estacion({ [clave]: haceMinutos(10) }));

      expect(r[campo as keyof typeof r]).toBeNull();
    });

    // Las diez magnitudes salen del mismo datalogger: si el timestamp venció,
    // vencieron todas. rs_mean (radiación solar) y uv_mean faltaban en el
    // switch y quedaban a la vista con el último valor conocido mientras el
    // resto del bloque se anulaba, indistinguibles de una medición actual.
    it("anula el bloque meteorológico completo cuando vence", () => {
      const r = applyFreshnessCheck(estacion({ meteo: haceMinutos(10) }));

      expect(r.dv_mean).toBeNull();
      expect(r.hr_mean).toBeNull();
      expect(r.hr_in_mean).toBeNull();
      expect(r.lluvia_mean).toBeNull();
      expect(r.temp_mean).toBeNull();
      expect(r.temp_in_mean).toBeNull();
      expect(r.vv_mean).toBeNull();
      expect(r.pa_mean).toBeNull();
      expect(r.rs_mean).toBeNull();
      expect(r.uv_mean).toBeNull();
    });
  });

  it("no muta el objeto recibido", () => {
    const original = estacion({ co: haceMinutos(10) });

    applyFreshnessCheck(original);

    // El repositorio devuelve el objeto ya parseado por Zod; si el servicio lo
    // mutara, cualquier consumidor previo vería los valores anulados.
    expect(original.co_mean).toBe(1);
  });

  it("reporta el estado de los siete instrumentos", () => {
    const r = applyFreshnessCheck(estacion({ co: haceMinutos(10), so2: null }));

    expect(Object.keys(r.freshness).sort()).toEqual([
      "co",
      "meteo",
      "nox",
      "o3",
      "pm10",
      "pm25",
      "so2",
    ]);
  });
});
