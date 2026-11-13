import { z } from "zod";

// Carga manual de promedios horarios ya validados (schema `carga` de airedb,
// V19 en ba-aire/data). El portal manda un lote de horas de UNA estación; gold
// las toma en su próxima corrida, y la hora cargada gana sobre la medida.
//
// Acá se valida la FORMA del pedido. La base vuelve a validar todo
// (carga.cargar y las CHECK de sus tablas).

const codigo = z
  .string()
  .trim()
  .regex(/^[a-z0-9_]+$/, "Código inválido");

export const MOTIVO_MIN = 10;
export const MOTIVO_MAX = 1000;
const motivo = z
  .string()
  .trim()
  .min(MOTIVO_MIN, `El motivo necesita al menos ${MOTIVO_MIN} caracteres`)
  .max(MOTIVO_MAX, `El motivo no puede pasar de ${MOTIVO_MAX} caracteres`);

// Un año de un equipo de tres parámetros son 26.280 horas. Más que eso es el
// histórico, que no va por el portal: se carga por consola en la VM.
export const MAX_HORAS = 30_000;

const Hora = z.object({
  parameter_code: codigo,
  // Inicio de la hora, en punto. La media hora no existe en Buenos Aires
  // (UTC-3), así que "en punto" es lo mismo en UTC.
  ts_hour: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "Hora inválida")
    .refine((s) => {
      const d = new Date(s);
      return (
        d.getUTCMinutes() === 0 &&
        d.getUTCSeconds() === 0 &&
        d.getUTCMilliseconds() === 0
      );
    }, "Las horas tienen que estar en punto"),
  value: z.number().finite(),
});

const Lote = z.object({
  station_code: codigo,
  horas: z
    .array(Hora)
    .min(1, "La carga no trae horas")
    .max(MAX_HORAS, `Una carga no puede pasar de ${MAX_HORAS} horas`),
});

export const VistaPreviaSchema = Lote;
export type VistaPreviaPedido = z.infer<typeof VistaPreviaSchema>;

export const CargarSchema = Lote.extend({
  archivo: z.string().trim().max(200).nullish(),
  motivo,
});
export type CargarPedido = z.infer<typeof CargarSchema>;

export const AnularSchema = z.object({ motivo });
export const CargaIdSchema = z.coerce.number().int().positive();

export const ListarSchema = z.object({
  station_code: codigo.optional(),
  estado: z.enum(["vigentes", "todas"]).default("vigentes"),
});
export type ListarFiltros = z.infer<typeof ListarSchema>;

export const LIMITE_LISTADO = 500;

// ---- Respuestas ---------------------------------------------------------------

export type Carga = {
  carga_id: number;
  origen: "portal" | "historico";
  station_code: string;
  station_name: string;
  archivo: string | null;
  motivo: string;
  registrado_por: string;
  registrado_en: string;
  n_horas: number;
  desde: string | null;
  hasta: string | null;
  parametros: string[];
  anulacion: {
    carga_id: number;
    motivo: string;
    registrado_por: string;
    registrado_en: string;
  } | null;
};

/** Lo que cambiaría la carga, por parámetro. */
export type VistaPreviaParametro = {
  parameter_code: string;
  display_name: string;
  unit: string | null;
  horas: number;
  desde: string;
  hasta: string;
  minimo: number;
  maximo: number;
  /** Horas del lote que hoy gold publica como válidas: la carga las reemplaza. */
  reemplaza_validas: number;
  /** Horas del lote que ya tienen una carga vigente: vale la nueva. */
  ya_cargadas: number;
};

export type VistaPrevia = { parametros: VistaPreviaParametro[] };
