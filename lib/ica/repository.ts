import { queryAiredb } from "@/db/airedb";
import type { IcaCategoria, Indice } from "./models";

// El índice de calidad del aire sale de las vistas gold.v_ica_* de airedb, que
// declara ba-aire/data (V16, V17 y R__indice_v_ica.sql). Acá no se calcula nada:
// ni cortes, ni truncados, ni NowCast. Qué significa cada columna está en
// data/docs/indice-calidad-aire.md.
//
// Las vistas traen los DOS índices en formato largo, con una columna `indice`.
// Toda consulta la filtra: sin ese filtro vendrían mezcladas categorías que no
// significan lo mismo.

// Hasta dónde se mira hacia atrás para encontrar la última hora con índice de
// cada estación. gold nunca tiene la hora en curso, así que lo normal es que la
// última sea de hace una o dos horas. Más allá de esto, la estación sale "sin
// índice" en vez de mostrar como actual un valor de la mañana.
//
// Además acota la consulta: el filtro por ts_hour llega al índice de la tabla de
// gold; sin él, la vista recorre toda la historia.
export const VENTANA = "6 hours";

export type FilaEstacion = {
  station_code: string;
  station_name: string;
  latitude: number | null;
  longitude: number | null;
  station_type: string | null;
  station_zone: string | null;
  station_description: string | null;
  ts_hour: Date | null;
  categoria: number | null;
  categoria_nombre: string | null;
  color_hex: string | null;
  valor: number | null;
  contaminante_principal: string | null;
  // Los tres arreglos vienen en el mismo orden: del peor contaminante al mejor.
  contaminantes: string[] | null;
  categorias: number[] | null;
  subindices: Array<number | null> | null;
  indice_completo: boolean | null;
};

// Una fila por estación de dim.stations, tenga índice o no: el LEFT JOIN deja a
// la que no tiene con las columnas del índice en NULL, y así sigue en el mapa.
// Coordenadas, tipo y descripción salen de dim.stations (V16), no de acá.
const SQL_ESTACIONES = `
  SELECT s.station_code, s.station_name,
         s.station_latitude::float8  AS latitude,
         s.station_longitude::float8 AS longitude,
         s.station_type, s.station_zone, s.station_description,
         i.ts_hour, i.categoria, i.categoria_nombre, i.color_hex, i.valor,
         i.contaminante_principal, i.contaminantes, i.categorias, i.subindices,
         i.indice_completo
  FROM dim.stations s
  LEFT JOIN LATERAL (
    SELECT *
    FROM gold.v_ica_horario v
    WHERE v.indice = $1
      AND v.station_id = s.station_id
      AND v.ts_hour >= now() - $2::interval
    ORDER BY v.ts_hour DESC
    LIMIT 1
  ) i ON true
  ORDER BY s.station_code`;

const SQL_CATEGORIAS = `
  SELECT categoria, nombre, color_hex
  FROM indice.v_categoria
  WHERE indice = $1
  ORDER BY categoria`;

// Los nombres para mostrar (NO₂, PM₂.₅) son de dim.parameters, como en el resto
// del portal. La meteo no participa de ningún índice.
const SQL_PARAMETROS = `
  SELECT parameter_code, display_name
  FROM dim.parameters
  WHERE measurement <> 'meteo'`;

/** Última hora con índice de cada estación, dentro de la ventana. */
export function fetchIcaEstaciones(indice: Indice): Promise<FilaEstacion[]> {
  return queryAiredb<FilaEstacion>(SQL_ESTACIONES, [indice, VENTANA]);
}

/** Las seis categorías del índice, con su nombre y color, para la leyenda. */
export function fetchIcaCategorias(indice: Indice): Promise<IcaCategoria[]> {
  return queryAiredb<IcaCategoria>(SQL_CATEGORIAS, [indice]);
}

/** parameter_code -> nombre para mostrar. */
export async function fetchNombresDeParametros(): Promise<
  Record<string, string>
> {
  const filas = await queryAiredb<{
    parameter_code: string;
    display_name: string;
  }>(SQL_PARAMETROS);
  return Object.fromEntries(
    filas.map((f) => [f.parameter_code, f.display_name]),
  );
}
