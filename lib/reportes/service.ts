import "server-only";

import { CONTAMINANTES, type Contaminante, type Estacion } from "./config";
import type { ReporteMensual } from "./models";
import {
  fetchDias,
  fetchEstadisticos,
  fetchExcedencias,
  fetchFicha,
  fetchPerfil,
} from "./repository";

/**
 * Todos los bloques del reporte mensual de una estación y un contaminante.
 * `mes` es "AAAA-MM". Las cinco consultas son independientes y van en paralelo.
 */
export async function getReporteMensual(
  estacion: Estacion,
  contaminante: Contaminante,
  mes: string,
): Promise<ReporteMensual> {
  const args: [string, string[], string] = [
    estacion,
    CONTAMINANTES[contaminante].parametros,
    `${mes}-01`,
  ];
  const [ficha, dias, estadisticos, excedencias, perfil] = await Promise.all([
    fetchFicha(...args),
    fetchDias(...args),
    fetchEstadisticos(...args),
    fetchExcedencias(...args),
    fetchPerfil(...args),
  ]);
  return {
    estacion,
    contaminante,
    mes,
    generado: new Date().toISOString(),
    ficha,
    dias,
    estadisticos,
    excedencias,
    perfil,
  };
}
