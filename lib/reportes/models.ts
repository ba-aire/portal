import { z } from "zod";
import {
  type Contaminante,
  ContaminanteEnum,
  type Estacion,
  EstacionEnum,
  MesSchema,
  PlantillaEnum,
} from "./config";

// Lo que pide la API: estación, contaminante, mes y, para el PDF, la plantilla.
export const ConsultaReporteSchema = z.object({
  estacion: EstacionEnum,
  contaminante: ContaminanteEnum,
  mes: MesSchema,
  formato: z.enum(["json", "pdf"]).default("json"),
  plantilla: PlantillaEnum.default("clasico"),
});
export type ConsultaReporte = z.infer<typeof ConsultaReporteSchema>;

// SD  Sin Dato: no hubo ninguna medición en la ventana.
// DND Dato No Disponible: hubo mediciones pero la ventana no es válida.
// (La regla vive en reporte.estado(), ba-aire/data V20.)
export type Estado = "ok" | "SD" | "DND";

// ---- Las filas, una por función de `reporte` ------------------------------------
// Los numeric de Postgres llegan como float8 (el repositorio castea): con
// node-postgres un numeric sin castear llega como string.

export type FichaParametro = {
  parameter_code: string;
  display_name: string;
  unidad: string;
  station_name: string;
  limite_deteccion: number | null;
  instrumentos: string | null;
};

export type Dia = {
  parameter_code: string;
  fecha: string; // AAAA-MM-DD
  dia: number;
  prom_24h: number | null;
  prom_24h_estado: Estado;
  bloque_0_8: number | null;
  bloque_0_8_estado: Estado;
  bloque_8_16: number | null;
  bloque_8_16_estado: Estado;
  bloque_16_24: number | null;
  bloque_16_24_estado: Estado;
  max_1h: number | null;
  min_1h: number | null;
  horas_estado: Estado;
  n_horas_validas: number;
};

export type Serie = "24h" | "8h_0_8" | "8h_8_16" | "8h_16_24" | "1h";

export type Estadistico = {
  parameter_code: string;
  serie: Serie;
  n: number;
  minimo: number | null;
  p95: number | null;
  p98: number | null;
  maximo: number | null;
  media: number | null;
  desvio: number | null;
  mediana: number | null;
};

export type Excedencia = {
  parameter_code: string;
  norma: string;
  cita: string;
  window_code: "1h" | "8h" | "24h";
  is_moving: boolean;
  periodo_publicado: string;
  limite: number;
  unidad: string;
  forma_cumplimiento: string | null;
  n_evaluados: number;
  n_excedencias: number;
  /** El valor más alto entre las ventanas evaluadas; null si no hubo ninguna. */
  maximo: number | null;
};

export type GrupoPerfil =
  | "mensual"
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo_feriado"
  | "lunes_a_viernes";

export type CeldaPerfil = {
  parameter_code: string;
  hora_inicio: number;
  grupo: GrupoPerfil;
  valor: number | null;
  n: number;
};

export type ReporteMensual = {
  estacion: Estacion;
  contaminante: Contaminante;
  mes: string; // AAAA-MM
  /** Cuándo se armó, ISO. Va al pie del PDF. */
  generado: string;
  ficha: FichaParametro[];
  dias: Dia[];
  estadisticos: Estadistico[];
  excedencias: Excedencia[];
  perfil: CeldaPerfil[];
};
