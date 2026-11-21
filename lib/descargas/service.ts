import { CODIGOS_ESTACION } from "@/lib/estaciones";
import {
  BoundedQueryParamsSchema,
  DataPointSchema,
  type QueryParams,
  type QueryResult,
  QueryResultSchema,
} from "./models";
import { fetchDatosPorEstacion } from "./repository";

/**
 * Servicio para manejar la lógica de negocio de datos de contaminantes
 */
export class DatosService {
  /**
   * Valida y procesa los parámetros de consulta.
   *
   * El schema vive en models.ts y define `location` e `integration` como enums.
   * Es deliberado y no debe reemplazarse por un schema local con tipos abiertos:
   * el repositorio interpola estos valores en SQL, así que el enum es lo que
   * mantiene acotado lo que puede llegar al WHERE.
   */
  private validateQueryParams(params: unknown): QueryParams {
    return BoundedQueryParamsSchema.parse(params);
  }

  /**
   * Obtiene datos de contaminantes con validación y procesamiento
   */
  // Sin try/catch a propósito: ver la nota equivalente en lib/datos/service.ts.
  // Los errores suben con su tipo intacto para que la route distinga validación
  // de fallo interno sin exponer el mensaje del driver.
  async getDatosPorEstacion(rawParams: unknown): Promise<QueryResult> {
    // Validar parámetros
    const validatedParams = this.validateQueryParams(rawParams);

    // Obtener datos del repositorio
    const result = await fetchDatosPorEstacion(validatedParams);

    // Parse data through Zod to convert BigInt values to numbers and handle nulls
    // El repository ya convierte el time a ISO string, pero por seguridad validamos
    const formattedData = result.data.map((row) => {
      // El time ya debería ser un string ISO desde el repository
      let timeValue: unknown = row.time;
      if (typeof timeValue === "number") {
        // Por si acaso llega como número (milisegundos)
        timeValue = new Date(Math.round(timeValue)).toISOString();
      } else if (timeValue instanceof Date) {
        timeValue = timeValue.toISOString();
      } else if (typeof timeValue !== "string") {
        timeValue = String(timeValue || "");
      }

      // Zod will convert BigInt to number via preprocess and handle nulls
      return DataPointSchema.parse({
        time: timeValue,
        ...row,
      });
    });

    // Retornar en formato estandarizado con conteo de registros
    const queryResult = {
      data: formattedData,
      meta: {
        location: result.meta.location,
        startDate: result.meta.startDate,
        endDate: result.meta.endDate,
        integration: result.meta.integration,
        count: result.data.length,
      },
    };

    // Validate the entire result structure
    return QueryResultSchema.parse(queryResult);
  }

  /**
   * Obtiene información sobre los contaminantes disponibles
   */
  getAvailableContaminants(): string[] {
    return ["co", "no2", "no", "nox", "pm10", "pm25", "o3", "so2"];
  }

  /**
   * Obtiene información sobre los intervalos disponibles
   */
  getAvailableIntervals(): string[] {
    return ["minute", "hour"];
  }

  /**
   * Obtiene información sobre las ubicaciones disponibles
   */
  getAvailableLocations(): string[] {
    return [...CODIGOS_ESTACION];
  }
}
// Exportar instancia singleton
export const datosService = new DatosService();
