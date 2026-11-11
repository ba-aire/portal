import { z } from "zod";

// Los dos índices que calcula ba-aire/data (gold.v_ica_*, columna `indice`):
//   EPA  el AQI de Estados Unidos: número de 0 a 500+ y seis categorías.
//   EEA  el European Air Quality Index: seis categorías, sin número.
// NO SE MEZCLAN: la categoría 3 de uno y la 3 del otro no dicen lo mismo. Por eso
// toda consulta lleva el índice, y este enum es la puerta: lo que no esté acá no
// llega a la base.
export const IndiceEnum = z.enum(["EPA", "EEA"]);
export type Indice = z.infer<typeof IndiceEnum>;

export const INDICES: Record<Indice, { nombre: string; descripcion: string }> =
  {
    EPA: {
      nombre: "AQI (EPA)",
      descripcion:
        "Índice de Estados Unidos. Número de 0 a 500: PM por NowCast, O₃ y CO por media móvil de 8 h, NO₂ y SO₂ horarios.",
    },
    EEA: {
      nombre: "Índice europeo (EEA)",
      descripcion:
        "Índice de la Agencia Europea de Medio Ambiente. Categoría sin número, sobre la concentración de la última hora. No incluye CO.",
    },
  };

/** Un contaminante dentro del índice de una estación, del peor al mejor. */
export type IcaContaminante = {
  parameter_code: string;
  nombre: string;
  categoria: number;
  /** El subíndice AQI. null en el índice europeo, que no tiene número. */
  subindice: number | null;
};

export type IcaEstacion = {
  station_code: string;
  station_name: string;
  latitude: number | null;
  longitude: number | null;
  station_type: string | null;
  station_zone: string | null;
  station_description: string | null;
  /** Inicio de la hora del índice (ISO). null = sin índice en la ventana. */
  ts_hour: string | null;
  categoria: number | null;
  categoria_nombre: string | null;
  color_hex: string | null;
  /** El AQI. null en el índice europeo y cuando no hay índice. */
  valor: number | null;
  contaminante_principal: string | null;
  contaminantes: IcaContaminante[];
  /** false = faltan contaminantes para el tipo de estación. null = sin clasificar. */
  indice_completo: boolean | null;
};

export type IcaCategoria = {
  categoria: number;
  nombre: string;
  color_hex: string | null;
};

/** La Ciudad: la peor de las estaciones que tienen índice. */
export type IcaCiudad = {
  categoria: number;
  categoria_nombre: string | null;
  color_hex: string | null;
  valor: number | null;
  station_code: string;
  station_name: string;
  contaminante_principal: string | null;
  n_estaciones: number;
};

export type IcaRespuesta = {
  indice: Indice;
  ciudad: IcaCiudad | null;
  estaciones: IcaEstacion[];
  categorias: IcaCategoria[];
};
