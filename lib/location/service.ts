// freshnessService.ts
import { differenceInSeconds } from "date-fns";
import type { FullLocationData } from "./models"; // el tipo que devuelve tu repo

// Una lectura de bronze más vieja que esto es una cabina que dejó de transmitir.
// Los equipos mandan cada 5-30 s (la estación meteorológica es la más lenta, a
// 30 s) y Telegraf escribe cada 10 s: 2 minutos son cuatro lecturas de la más
// lenta perdidas, sin dar alarmas falsas por un flush demorado.
const FRESHNESS_THRESHOLD_SECONDS = 120;

export function applyFreshnessCheck(data: FullLocationData) {
  const now = new Date();

  const freshness: Record<string, "fresh" | "stale"> = {};
  const sanitizedData = { ...data };

  for (const [key, ts] of Object.entries(data.timestamps)) {
    if (!ts) {
      freshness[key] = "stale";
      // ya está en null en data, no se toca
      continue;
    }

    const secondsOld = differenceInSeconds(now, new Date(ts));

    if (secondsOld <= FRESHNESS_THRESHOLD_SECONDS) {
      freshness[key] = "fresh";
    } else {
      freshness[key] = "stale";

      // 👉 anular los valores asociados a este measurement
      switch (key) {
        case "co":
          sanitizedData.co_mean = null;
          sanitizedData.co_mean_status = null;
          break;
        case "nox":
          sanitizedData.no_mean = null;
          sanitizedData.no2_mean = null;
          sanitizedData.nox_mean = null;
          sanitizedData.nox_mean_status = null;
          break;
        case "o3":
          sanitizedData.o3_mean = null;
          sanitizedData.o3_mean_status = null;
          break;
        case "so2":
          sanitizedData.so2_mean = null;
          sanitizedData.so2_mean_status = null;
          break;
        case "pm10":
          sanitizedData.pm10_mean = null;
          sanitizedData.pm10_mean_status = null;
          break;
        case "pm25":
          sanitizedData.pm25_mean = null;
          sanitizedData.pm25_mean_status = null;
          break;
        case "meteo":
          // Las diez salen del mismo datalogger: si el timestamp está vencido,
          // vencieron todas. rs_mean y uv_mean faltaban acá y quedaban a la
          // vista con el último valor conocido mientras el resto se anulaba.
          sanitizedData.dv_mean = null;
          sanitizedData.hr_in_mean = null;
          sanitizedData.hr_mean = null;
          sanitizedData.lluvia_mean = null;
          sanitizedData.temp_mean = null;
          sanitizedData.temp_in_mean = null;
          sanitizedData.vv_mean = null;
          sanitizedData.pa_mean = null;
          sanitizedData.rs_mean = null;
          sanitizedData.uv_mean = null;
          break;
      }
    }
  }

  return {
    ...sanitizedData,
    freshness,
  };
}
