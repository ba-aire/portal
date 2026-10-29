import {
  BoundedQueryParamsSchema,
  type Contaminant,
  type Interval,
  type QueryParams,
  type QueryResult,
} from "./models";
import { fetchDatosPorContaminante } from "./repository";

/**
 * Servicio para manejar la lógica de negocio de datos de contaminantes
 */
export class DatosService {
  /**
   * Valida y procesa los parámetros de consulta
   */
  private validateQueryParams(params: unknown): QueryParams {
    return BoundedQueryParamsSchema.parse(params);
  }

  /**
   * Obtiene datos de contaminantes con validación y procesamiento
   */
  // Sin try/catch a propósito: los errores deben subir con su tipo intacto para que
  // la route distinga un ZodError (400, con detalle) de un fallo de InfluxDB (500,
  // genérico). Envolverlos en un Error nuevo borra esa distinción y arrastra el
  // mensaje del driver —que incluye SQL y nombres de tabla— hasta la respuesta.
  async getDatosPorContaminante(rawParams: unknown): Promise<QueryResult> {
    // Validar parámetros
    const validatedParams = this.validateQueryParams(rawParams);

    // Obtener datos del repositorio
    const result = await fetchDatosPorContaminante(validatedParams);

    // Ensure data conforms to DataPointSchema (formato original)
    const formattedData = result.data.map(
      (row: Record<string, string | number>) => ({
        time: String(row.time || ""),
        ...row,
      }),
    );

    // Retornar en formato estandarizado con conteo de registros
    return {
      data: formattedData,
      meta: {
        ...result.meta,
        contaminant: result.meta.contaminant as Contaminant,
        interval: result.meta.interval as Interval,
        count: result.data.length,
      },
    };
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
    return ["minute", "hour", "day"];
  }

  /**
   * Obtiene información sobre las ubicaciones disponibles
   */
  getAvailableLocations(): string[] {
    return ["centenario", "cordoba", "catalinas", "cifa"];
  }
}
// Exportar instancia singleton
export const datosService = new DatosService();
