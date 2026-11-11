import type {
  IcaCiudad,
  IcaContaminante,
  IcaEstacion,
  IcaRespuesta,
  Indice,
} from "./models";
import {
  type FilaEstacion,
  fetchIcaCategorias,
  fetchIcaEstaciones,
  fetchNombresDeParametros,
} from "./repository";

// La vista devuelve tres arreglos paralelos (códigos, categorías, subíndices),
// ya ordenados del peor al mejor. Acá se cosen en una lista, con el nombre para
// mostrar de cada contaminante.
function contaminantesDe(
  fila: FilaEstacion,
  nombres: Record<string, string>,
): IcaContaminante[] {
  return (fila.contaminantes ?? []).map((codigo, i) => ({
    parameter_code: codigo,
    nombre: nombres[codigo] ?? codigo,
    categoria: fila.categorias?.[i] ?? 0,
    subindice: fila.subindices?.[i] ?? null,
  }));
}

function aEstacion(
  fila: FilaEstacion,
  nombres: Record<string, string>,
): IcaEstacion {
  return {
    station_code: fila.station_code,
    station_name: fila.station_name,
    latitude: fila.latitude,
    longitude: fila.longitude,
    station_type: fila.station_type,
    station_zone: fila.station_zone,
    station_description: fila.station_description,
    ts_hour: fila.ts_hour ? fila.ts_hour.toISOString() : null,
    categoria: fila.categoria,
    categoria_nombre: fila.categoria_nombre,
    color_hex: fila.color_hex,
    valor: fila.valor,
    contaminante_principal: fila.contaminante_principal,
    contaminantes: contaminantesDe(fila, nombres),
    indice_completo: fila.indice_completo,
  };
}

// El índice de la Ciudad es el de la PEOR estación, no un promedio: es el
// criterio de "área de reporte" de la EPA, y el mismo de gold.v_ica_ciudad_horario.
//
// Se calcula acá, sobre las estaciones que se muestran, y no se lee de esa vista:
// cada estación trae SU última hora con índice, y no siempre es la misma (una
// puede estar una hora atrasada). Con la vista, la tarjeta de la Ciudad podría
// nombrar una hora en la que la peor estación de la pantalla todavía no figura.
//
// Gana la categoría más alta; a igual categoría, el AQI más alto (en el índice
// europeo no hay número y desempata el orden de la lista).
export function ciudadDe(estaciones: IcaEstacion[]): IcaCiudad | null {
  const conIndice = estaciones.filter((e) => e.categoria !== null);
  if (conIndice.length === 0) return null;

  const peor = conIndice.reduce((a, b) => {
    const ca = a.categoria ?? 0;
    const cb = b.categoria ?? 0;
    if (cb !== ca) return cb > ca ? b : a;
    return (b.valor ?? -1) > (a.valor ?? -1) ? b : a;
  });

  return {
    categoria: peor.categoria ?? 0,
    categoria_nombre: peor.categoria_nombre,
    color_hex: peor.color_hex,
    valor: peor.valor,
    station_code: peor.station_code,
    station_name: peor.station_name,
    contaminante_principal: peor.contaminante_principal,
    n_estaciones: conIndice.length,
  };
}

export async function getIca(indice: Indice): Promise<IcaRespuesta> {
  const [filas, categorias, nombres] = await Promise.all([
    fetchIcaEstaciones(indice),
    fetchIcaCategorias(indice),
    fetchNombresDeParametros(),
  ]);
  const estaciones = filas.map((f) => aEstacion(f, nombres));

  return {
    indice,
    ciudad: ciudadDe(estaciones),
    estaciones,
    categorias,
  };
}
